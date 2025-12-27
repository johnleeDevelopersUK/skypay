// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../utils/Errors.sol";
import "../interfaces/IRelayer.sol";

contract SkyPayRelayer is IRelayer, AccessControl, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint256 public gasPrice = 20 gwei;
    uint256 public baseFee = 0.001 ether;
    uint256 public perByteFee = 100; // wei per byte
    address public feeCollector;

    mapping(address => uint256) public nonces;
    mapping(address => mapping(address => uint256)) public gasBalances;
    mapping(bytes32 => GasReceipt) public gasReceipts;
    mapping(address => bool) public isRelayer;

    modifier onlyRelayer() {
        if (!isRelayer[msg.sender]) revert Errors.NotRelayer();
        _;
    }

    constructor(address admin, address feeCollector_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(RELAYER_ROLE, admin);
        
        isRelayer[admin] = true;
        feeCollector = feeCollector_;
    }

    function relay(RelayRequest calldata request) 
        external 
        override 
        onlyRelayer 
        whenNotPaused 
        returns (bytes memory) 
    {
        _validateRequest(request);
        
        // Verify signature
        bytes32 hash = keccak256(abi.encode(
            block.chainid,
            address(this),
            request.from,
            request.to,
            request.data,
            request.gasLimit,
            request.nonce,
            request.deadline
        ));
        
        address signer = _recoverSigner(hash, request.signature);
        if (signer != request.from) revert Errors.InvalidSignature();
        
        // Check nonce
        if (request.nonce != nonces[request.from]) revert Errors.InvalidNonce();
        nonces[request.from]++;

        // Check deadline
        if (block.timestamp > request.deadline) revert Errors.ExpiredDeadline();

        // Estimate gas cost
        uint256 estimatedGas = request.gasLimit * gasPrice;
        uint256 dataFee = request.data.length * perByteFee;
        uint256 totalFee = baseFee + estimatedGas + dataFee;

        // Check gas balance
        if (gasBalances[request.from][address(0)] < totalFee) {
            revert Errors.InsufficientGasBalance();
        }

        // Execute transaction
        (bool success, bytes memory result) = request.to.call{value: request.value}(
            request.data
        );

        // Calculate actual gas used
        uint256 gasUsed = request.gasLimit;
        // In production, we would use gasleft() to calculate actual gas used

        // Charge gas fees
        uint256 actualCost = gasUsed * gasPrice + dataFee + baseFee;
        gasBalances[request.from][address(0)] -= actualCost;
        gasBalances[feeCollector][address(0)] += actualCost;

        // Create receipt
        bytes32 receiptId = keccak256(abi.encode(
            request.from,
            request.to,
            request.data,
            gasUsed,
            block.timestamp
        ));
        
        gasReceipts[receiptId] = GasReceipt({
            user: request.from,
            token: address(0),
            amount: actualCost,
            gasUsed: gasUsed,
            timestamp: block.timestamp
        });

        emit GasPaid(request.from, actualCost, address(0));

        if (!success) {
            revert Errors.RelayFailed(result);
        }

        return result;
    }

    function relayBatch(RelayRequest[] calldata requests) 
        external 
        override 
        onlyRelayer 
        whenNotPaused 
        returns (bytes[] memory) 
    {
        bytes[] memory results = new bytes[](requests.length);
        
        for (uint256 i = 0; i < requests.length; i++) {
            results[i] = this.relay(requests[i]);
        }
        
        return results;
    }

    function relayWithToken(
        RelayRequest calldata request,
        address token,
        uint256 amount
    ) external override onlyRelayer whenNotPaused returns (bytes memory) {
        // Transfer tokens from user
        IERC20(token).safeTransferFrom(request.from, address(this), amount);
        
        // Execute relay
        bytes memory result = this.relay(request);
        
        return result;
    }

    function depositGas(address token, uint256 amount) external override whenNotPaused {
        if (token == address(0)) {
            if (msg.value != amount) revert Errors.InvalidAmount();
            gasBalances[msg.sender][address(0)] += amount;
        } else {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
            gasBalances[msg.sender][token] += amount;
        }
    }

    function withdrawGas(address token, uint256 amount) external override whenNotPaused {
        if (gasBalances[msg.sender][token] < amount) revert Errors.InsufficientGasBalance();
        
        gasBalances[msg.sender][token] -= amount;
        
        if (token == address(0)) {
            payable(msg.sender).transfer(amount);
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }
    }

    function getUserGasBalance(address user, address token) 
        external 
        view 
        override 
        returns (uint256) 
    {
        return gasBalances[user][token];
    }

    function payGasForUser(address user, uint256 gasUsed, address token) 
        external 
        override 
        onlyRelayer 
    {
        uint256 cost = gasUsed * gasPrice;
        
        if (gasBalances[user][token] < cost) {
            revert Errors.InsufficientGasBalance();
        }
        
        gasBalances[user][token] -= cost;
        gasBalances[feeCollector][token] += cost;
        
        emit GasPaid(user, cost, token);
    }

    function estimateRelayCost(RelayRequest calldata request) 
        external 
        view 
        override 
        returns (uint256) 
    {
        uint256 gasCost = request.gasLimit * gasPrice;
        uint256 dataCost = request.data.length * perByteFee;
        return baseFee + gasCost + dataCost;
    }

    function addRelayer(address relayer) external override onlyRole(ADMIN_ROLE) {
        isRelayer[relayer] = true;
        _grantRole(RELAYER_ROLE, relayer);
        emit RelayerAdded(relayer);
    }

    function removeRelayer(address relayer) external override onlyRole(ADMIN_ROLE) {
        isRelayer[relayer] = false;
        _revokeRole(RELAYER_ROLE, relayer);
        emit RelayerRemoved(relayer);
    }

    function setGasPrice(uint256 newPrice) external override onlyRole(ADMIN_ROLE) {
        uint256 oldPrice = gasPrice;
        gasPrice = newPrice;
        emit GasPriceUpdated(oldPrice, newPrice);
    }

    function setFeeStructure(uint256 newBaseFee, uint256 newPerByteFee) 
        external 
        override 
        onlyRole(ADMIN_ROLE) 
    {
        uint256 oldBaseFee = baseFee;
        uint256 oldPerByteFee = perByteFee;
        
        baseFee = newBaseFee;
        perByteFee = newPerByteFee;
        
        emit FeeStructureUpdated(oldBaseFee, newBaseFee);
    }

    function collectFees(address token) external override onlyRole(ADMIN_ROLE) {
        uint256 amount = gasBalances[feeCollector][token];
        if (amount == 0) return;
        
        gasBalances[feeCollector][token] = 0;
        
        if (token == address(0)) {
            payable(feeCollector).transfer(amount);
        } else {
            IERC20(token).safeTransfer(feeCollector, amount);
        }
    }

    function getRelayers() external view override returns (address[] memory) {
        address[] memory relayers = new address[](1);
        uint256 count = 0;
        
        // In production, maintain a list of relayers
        if (isRelayer[msg.sender]) {
            relayers[count] = msg.sender;
            count++;
        }
        
        return relayers;
    }

    function pauseRelaying() external override onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpauseRelaying() external override onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function _validateRequest(RelayRequest calldata request) private pure {
        if (request.to == address(0)) revert Errors.InvalidAddress();
        if (request.gasLimit == 0) revert Errors.InvalidGasLimit();
    }

    function _recoverSigner(bytes32 hash, bytes memory signature) 
        private 
        pure 
        returns (address) 
    {
        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(signature);
        return ecrecover(hash, v, r, s);
    }

    function _splitSignature(bytes memory signature) 
        private 
        pure 
        returns (bytes32 r, bytes32 s, uint8 v) 
    {
        if (signature.length != 65) revert Errors.InvalidSignatureLength();
        
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert Errors.InvalidSignatureV();
    }

    receive() external payable {
        gasBalances[msg.sender][address(0)] += msg.value;
    }
}
