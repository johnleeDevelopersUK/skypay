// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "../utils/Errors.sol";
import "../interfaces/IBridgeAdapter.sol";

contract BridgeAdapter is IBridgeAdapter, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    uint256 public bridgeFee = 5; // 0.05%
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    address public feeCollector;
    address public guardian;
    
    mapping(bytes32 => BridgeStatus) public bridgeStatuses;
    mapping(uint256 => bool) public supportedChains;
    mapping(uint256 => address) public chainGateways;
    mapping(uint256 => uint256) public chainMinAmounts;
    mapping(uint256 => uint256) public chainMaxAmounts;
    mapping(address => uint256) public bridgeNonces;
    mapping(bytes32 => bool) public processedHashes;
    
    uint256[] public chainIds;
    
    modifier onlyRelayer() {
        if (!hasRole(RELAYER_ROLE, msg.sender)) revert Errors.NotRelayer();
        _;
    }
    
    modifier onlyGuardian() {
        if (msg.sender != guardian && !hasRole(GUARDIAN_ROLE, msg.sender)) {
            revert Errors.NotGuardian();
        }
        _;
    }

    constructor(address admin, address feeCollector_, address guardian_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(RELAYER_ROLE, admin);
        
        feeCollector = feeCollector_;
        guardian = guardian_;
        
        // Add current chain as supported
        supportedChains[block.chainid] = true;
        chainIds.push(block.chainid);
    }

    function bridgeTokens(
        address token,
        uint256 amount,
        uint256 destChain,
        address destAddress
    ) 
        external 
        payable 
        override 
        nonReentrant 
        whenNotPaused 
        returns (bytes32 bridgeId) 
    {
        if (!supportedChains[destChain]) revert Errors.ChainNotSupported();
        if (amount == 0) revert Errors.InvalidAmount();
        
        // Check chain limits
        if (amount < chainMinAmounts[destChain]) revert Errors.AmountBelowMinimum();
        if (amount > chainMaxAmounts[destChain] && chainMaxAmounts[destChain] > 0) {
            revert Errors.AmountAboveMaximum();
        }
        
        // Calculate bridge fee
        uint256 fee = amount.mul(bridgeFee).div(FEE_DENOMINATOR);
        uint256 netAmount = amount.sub(fee);
        
        // Transfer tokens
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Generate bridge ID
        bridgeId = keccak256(abi.encode(
            msg.sender,
            token,
            amount,
            destChain,
            destAddress,
            bridgeNonces[msg.sender]++,
            block.timestamp
        ));
        
        // Store bridge status
        bridgeStatuses[bridgeId] = BridgeStatus({
            sourceTxHash: keccak256(abi.encodePacked(tx.origin, block.number)),
            destTxHash: bytes32(0),
            timestamp: block.timestamp,
            state: BridgeState.PENDING
        });
        
        // Lock tokens (in production, this would be a separate vault)
        // For now, we just hold them in the contract
        
        // Collect fee
        if (fee > 0) {
            IERC20(token).safeTransfer(feeCollector, fee);
        }
        
        emit BridgeInitiated(bridgeId, msg.sender, token, amount, block.chainid, destChain);
        
        return bridgeId;
    }

    function completeBridge(
        bytes32 bridgeId,
        address token,
        address recipient,
        uint256 amount,
        uint256 sourceChain,
        bytes32 sourceTxHash
    ) 
        external 
        override 
        onlyRelayer 
        nonReentrant 
        returns (bool) 
    {
        if (processedHashes[sourceTxHash]) revert Errors.HashAlreadyProcessed();
        
        BridgeStatus storage status = bridgeStatuses[bridgeId];
        if (status.state != BridgeState.PENDING) revert Errors.InvalidBridgeState();
        
        // Verify this is for the correct chain
        if (!supportedChains[sourceChain]) revert Errors.ChainNotSupported();
        
        // Update status
        status.destTxHash = keccak256(abi.encodePacked(tx.origin, block.number));
        status.state = BridgeState.COMPLETED;
        processedHashes[sourceTxHash] = true;
        
        // Unlock and transfer tokens
        IERC20(token).safeTransfer(recipient, amount);
        
        emit BridgeCompleted(bridgeId, status.destTxHash);
        
        return true;
    }

    function refundBridge(bytes32 bridgeId, string calldata reason) 
        external 
        override 
        onlyRelayer 
        nonReentrant 
        returns (bool) 
    {
        BridgeStatus storage status = bridgeStatuses[bridgeId];
        if (status.state != BridgeState.PENDING) revert Errors.InvalidBridgeState();
        
        // Check if enough time has passed (7 days)
        if (block.timestamp < status.timestamp + 7 days) {
            revert Errors.RefundTooEarly();
        }
        
        // Parse bridge ID to get original sender and amount
        // In production, we would store this information separately
        // For now, we'll use a simplified approach
        
        // Mark as refunded
        status.state = BridgeState.REFUNDED;
        
        emit BridgeRefunded(bridgeId, msg.sender, 0); // Amount would be retrieved from storage
        
        return true;
    }

    function addSupportedChain(uint256 chainId) 
        external 
        override 
        onlyRole(ADMIN_ROLE) 
    {
        if (supportedChains[chainId]) revert Errors.ChainAlreadySupported();
        
        supportedChains[chainId] = true;
        chainIds.push(chainId);
        
        emit ChainSupported(chainId, true);
    }

    function setChainGateway(uint256 chainId, address gateway) 
        external 
        override 
        onlyRole(ADMIN_ROLE) 
    {
        if (!supportedChains[chainId]) revert Errors.ChainNotSupported();
        
        chainGateways[chainId] = gateway;
    }

    function setChainLimits(uint256 chainId, uint256 minAmount, uint256 maxAmount) 
        external 
        override 
        onlyRole(ADMIN_ROLE) 
    {
        if (!supportedChains[chainId]) revert Errors.ChainNotSupported();
        
        chainMinAmounts[chainId] = minAmount;
        chainMaxAmounts[chainId] = maxAmount;
    }

    function setBridgeFee(uint256 fee) external override onlyRole(ADMIN_ROLE) {
        if (fee > 100) revert Errors.FeeTooHigh(); // Max 1%
        
        uint256 oldFee = bridgeFee;
        bridgeFee = fee;
        
        emit BridgeFeeUpdated(oldFee, fee);
    }

    function collectFees(address token) external override onlyRole(ADMIN_ROLE) {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(feeCollector, balance);
    }

    function pauseBridging() external override onlyGuardian {
        _pause();
    }

    function unpauseBridging() external override onlyGuardian {
        _unpause();
    }

    function emergencyHalt() external override onlyGuardian {
        _pause();
        
        // In production, this would trigger additional emergency procedures
    }

    function resumeOperations() external override onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function verifyBridgeProof(
        bytes32 bridgeId,
        bytes calldata proof,
        bytes32 root
    ) 
        external 
        view 
        override 
        returns (bool) 
    {
        // Verify Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(bridgeId));
        return MerkleProof.verify(proof, root, leaf);
    }

    function getBridgeStatus(bytes32 bridgeId) 
        external 
        view 
        override 
        returns (BridgeStatus memory) 
    {
        return bridgeStatuses[bridgeId];
    }

    function getSupportedChains() 
        external 
        view 
        override 
        returns (uint256[] memory) 
    {
        return chainIds;
    }

    function calculateBridgeFee(address token, uint256 amount, uint256 destChain) 
        external 
        view 
        override 
        returns (uint256) 
    {
        if (!supportedChains[destChain]) return 0;
        return amount.mul(bridgeFee).div(FEE_DENOMINATOR);
    }

    function getBridgeNonce(address user) 
        external 
        view 
        override 
        returns (uint256) 
    {
        return bridgeNonces[user];
    }

    function estimateBridgeTime(uint256 destChain) 
        external 
        pure 
        override 
        returns (uint256) 
    {
        // Default estimation based on chain
        if (destChain == 137) return 15 minutes; // Polygon
        if (destChain == 1) return 30 minutes;   // Ethereum
        if (destChain == 56) return 10 minutes;  // BSC
        return 20 minutes; // Default
    }
}
