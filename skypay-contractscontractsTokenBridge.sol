// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./SkyPayToken.sol";

/**
 * @title Token Bridge for Cross-Chain Transfers
 * @dev Handles bridging of tokens between different chains
 */
contract TokenBridge is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant BRIDGE_OPERATOR_ROLE = keccak256("BRIDGE_OPERATOR_ROLE");
    
    // Bridge fees
    uint256 public bridgeFeePercentage = 5; // 0.05%
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Supported chains
    struct ChainInfo {
        bool supported;
        address gateway;
        uint256 minTransfer;
        uint256 maxTransfer;
    }
    
    mapping(uint256 => ChainInfo) public supportedChains;
    
    // Transfer tracking
    struct BridgeTransfer {
        address user;
        uint256 amount;
        uint256 sourceChain;
        uint256 destChain;
        address token;
        bytes32 sourceTxHash;
        bytes32 destTxHash;
        uint256 timestamp;
        BridgeStatus status;
    }
    
    enum BridgeStatus {
        PENDING,
        PROCESSING,
        COMPLETED,
        FAILED,
        REFUNDED
    }
    
    mapping(bytes32 => BridgeTransfer) public transfers;
    mapping(bytes32 => bool) public processedHashes;
    
    // Token registry
    mapping(address => bool) public supportedTokens;
    
    // Events
    event BridgeInitiated(
        bytes32 indexed transferId,
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 sourceChain,
        uint256 destChain,
        uint256 fee,
        uint256 timestamp
    );
    
    event BridgeCompleted(
        bytes32 indexed transferId,
        bytes32 indexed destTxHash,
        uint256 completedAt
    );
    
    event BridgeFailed(
        bytes32 indexed transferId,
        string reason,
        uint256 failedAt
    );
    
    event BridgeRefunded(
        bytes32 indexed transferId,
        address indexed user,
        uint256 amount,
        uint256 refundedAt
    );
    
    event ChainConfigured(
        uint256 indexed chainId,
        address gateway,
        uint256 minTransfer,
        uint256 maxTransfer,
        bool supported
    );
    
    event TokenAdded(address indexed token, bool supported);
    event BridgeFeeUpdated(uint256 oldFee, uint256 newFee);
    
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(BRIDGE_OPERATOR_ROLE, admin);
    }
    
    /**
     * @dev Initiate a bridge transfer
     */
    function bridgeOut(
        address token,
        uint256 amount,
        uint256 destChain,
        bytes32 destAddress
    ) external payable nonReentrant whenNotPaused returns (bytes32) {
        require(supportedTokens[token], "Token not supported");
        require(supportedChains[destChain].supported, "Chain not supported");
        require(amount >= supportedChains[destChain].minTransfer, "Amount below minimum");
        require(amount <= supportedChains[destChain].maxTransfer, "Amount above maximum");
        
        SkyPayToken tokenContract = SkyPayToken(token);
        require(tokenContract.balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // Calculate bridge fee
        uint256 fee = (amount * bridgeFeePercentage) / FEE_DENOMINATOR;
        uint256 netAmount = amount - fee;
        
        // Transfer tokens to bridge
        require(
            tokenContract.transferFrom(msg.sender, address(this), amount),
            "Token transfer failed"
        );
        
        // Generate transfer ID
        bytes32 transferId = keccak256(
            abi.encodePacked(
                msg.sender,
                token,
                amount,
                destChain,
                destAddress,
                block.timestamp
            )
        );
        
        // Store transfer
        transfers[transferId] = BridgeTransfer({
            user: msg.sender,
            amount: amount,
            sourceChain: block.chainid,
            destChain: destChain,
            token: token,
            sourceTxHash: bytes32(0),
            destTxHash: bytes32(0),
            timestamp: block.timestamp,
            status: BridgeStatus.PENDING
        });
        
        // Burn tokens (or lock, depending on bridge type)
        _lockOrBurnTokens(token, amount);
        
        emit BridgeInitiated(
            transferId,
            msg.sender,
            token,
            amount,
            block.chainid,
            destChain,
            fee,
            block.timestamp
        );
        
        return transferId;
    }
    
    /**
     * @dev Complete a bridge transfer (called by bridge operators)
     */
    function bridgeIn(
        bytes32 transferId,
        address token,
        address recipient,
        uint256 amount,
        uint256 sourceChain,
        bytes32 sourceTxHash
    ) external onlyRole(BRIDGE_OPERATOR_ROLE) nonReentrant returns (bool) {
        require(!processedHashes[sourceTxHash], "Transfer already processed");
        require(supportedTokens[token], "Token not supported");
        
        // Mint or unlock tokens
        _mintOrUnlockTokens(token, recipient, amount);
        
        // Update transfer record
        BridgeTransfer storage transfer = transfers[transferId];
        transfer.destTxHash = keccak256(abi.encodePacked(blockhash(block.number - 1), block.timestamp));
        transfer.sourceTxHash = sourceTxHash;
        transfer.status = BridgeStatus.COMPLETED;
        processedHashes[sourceTxHash] = true;
        
        emit BridgeCompleted(transferId, transfer.destTxHash, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Refund a failed bridge transfer
     */
    function refundBridge(
        bytes32 transferId,
        string memory reason
    ) external onlyRole(BRIDGE_OPERATOR_ROLE) nonReentrant returns (bool) {
        BridgeTransfer storage transfer = transfers[transferId];
        require(transfer.status == BridgeStatus.PENDING, "Transfer not pending");
        require(transfer.timestamp + 7 days < block.timestamp, "Too early to refund");
        
        // Unlock or mint tokens back to user
        _mintOrUnlockTokens(transfer.token, transfer.user, transfer.amount);
        
        transfer.status = BridgeStatus.REFUNDED;
        
        emit BridgeRefunded(
            transferId,
            transfer.user,
            transfer.amount,
            block.timestamp
        );
        
        return true;
    }
    
    /**
     * @dev Mark bridge as failed
     */
    function markBridgeFailed(
        bytes32 transferId,
        string memory reason
    ) external onlyRole(BRIDGE_OPERATOR_ROLE) nonReentrant {
        BridgeTransfer storage transfer = transfers[transferId];
        transfer.status = BridgeStatus.FAILED;
        
        emit BridgeFailed(transferId, reason, block.timestamp);
    }
    
    /**
     * @dev Lock or burn tokens (depending on bridge type)
     */
    function _lockOrBurnTokens(address token, uint256 amount) private {
        SkyPayToken tokenContract = SkyPayToken(token);
        
        // For burn-and-mint bridges
        tokenContract.burn(address(this), amount, "BRIDGE_OUT");
        
        // For lock-and-mint bridges, we would lock tokens instead
        // tokenContract.transfer(address(lockContract), amount);
    }
    
    /**
     * @dev Mint or unlock tokens (depending on bridge type)
     */
    function _mintOrUnlockTokens(
        address token,
        address recipient,
        uint256 amount
    ) private {
        SkyPayToken tokenContract = SkyPayToken(token);
        
        // For burn-and-mint bridges
        tokenContract.mint(recipient, amount, "BRIDGE_IN");
        
        // For lock-and-mint bridges, we would unlock tokens instead
        // lockContract.releaseTokens(recipient, amount);
    }
    
    /**
     * @dev Configure a supported chain
     */
    function configureChain(
        uint256 chainId,
        address gateway,
        uint256 minTransfer,
        uint256 maxTransfer,
        bool supported
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedChains[chainId] = ChainInfo({
            supported: supported,
            gateway: gateway,
            minTransfer: minTransfer,
            maxTransfer: maxTransfer
        });
        
        emit ChainConfigured(chainId, gateway, minTransfer, maxTransfer, supported);
    }
    
    /**
     * @dev Add/remove supported token
     */
    function setTokenSupport(
        address token,
        bool supported
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedTokens[token] = supported;
        emit TokenAdded(token, supported);
    }
    
    /**
     * @dev Update bridge fee percentage
     */
    function setBridgeFee(
        uint256 newFeePercentage
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFeePercentage <= 100, "Fee too high"); // Max 1%
        uint256 oldFee = bridgeFeePercentage;
        bridgeFeePercentage = newFeePercentage;
        emit BridgeFeeUpdated(oldFee, newFeePercentage);
    }
    
    /**
     * @dev Get transfer details
     */
    function getTransfer(
        bytes32 transferId
    ) external view returns (BridgeTransfer memory) {
        return transfers[transferId];
    }
    
    /**
     * @dev Calculate bridge fee for an amount
     */
    function calculateBridgeFee(
        uint256 amount
    ) external view returns (uint256) {
        return (amount * bridgeFeePercentage) / FEE_DENOMINATOR;
    }
    
    /**
     * @dev Pause bridge operations
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause bridge operations
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Withdraw collected fees (in native token)
     */
    function withdrawFees(
        address payable to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(to != address(0), "Invalid address");
        require(amount <= address(this).balance, "Insufficient balance");
        to.transfer(amount);
    }
    
    /**
     * @dev Emergency withdraw tokens (for lock-and-mint bridges)
     */
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(to != address(0), "Invalid address");
        SkyPayToken tokenContract = SkyPayToken(token);
        require(
            tokenContract.balanceOf(address(this)) >= amount,
            "Insufficient token balance"
        );
        tokenContract.transfer(to, amount);
    }
    
    // Receive function for native token (fees)
    receive() external payable {}
}
