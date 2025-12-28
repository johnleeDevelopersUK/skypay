// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IBridgeAdapter {
    // Events
    event BridgeInitiated(
        bytes32 indexed bridgeId,
        address indexed user,
        address token,
        uint256 amount,
        uint256 sourceChain,
        uint256 destChain
    );
    event BridgeCompleted(
        bytes32 indexed bridgeId,
        bytes32 indexed destTxHash
    );
    event BridgeFailed(
        bytes32 indexed bridgeId,
        string reason
    );
    event BridgeRefunded(
        bytes32 indexed bridgeId,
        address indexed user,
        uint256 amount
    );
    event ChainSupported(uint256 chainId, bool supported);
    event BridgeFeeUpdated(uint256 oldFee, uint256 newFee);

    // Structs
    struct BridgeRequest {
        address user;
        address token;
        uint256 amount;
        uint256 sourceChain;
        uint256 destChain;
        address destAddress;
        uint256 nonce;
        uint256 deadline;
        bytes signature;
    }

    struct BridgeStatus {
        bytes32 sourceTxHash;
        bytes32 destTxHash;
        uint256 timestamp;
        BridgeState state;
    }

    enum BridgeState {
        PENDING,
        PROCESSING,
        COMPLETED,
        FAILED,
        REFUNDED
    }

    // View functions
    function getBridgeStatus(bytes32 bridgeId) external view returns (BridgeStatus memory);
    function getSupportedChains() external view returns (uint256[] memory);
    function isChainSupported(uint256 chainId) external view returns (bool);
    function calculateBridgeFee(address token, uint256 amount, uint256 destChain) 
        external view returns (uint256);
    function getBridgeNonce(address user) external view returns (uint256);
    function estimateBridgeTime(uint256 destChain) external view returns (uint256);
    function getBridgeRequests(address user) external view returns (bytes32[] memory);

    // Bridge functions
    function bridgeTokens(
        address token,
        uint256 amount,
        uint256 destChain,
        address destAddress
    ) external payable returns (bytes32 bridgeId);
    
    function bridgeTokensWithPermit(
        address token,
        uint256 amount,
        uint256 destChain,
        address destAddress,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable returns (bytes32 bridgeId);
    
    function completeBridge(
        bytes32 bridgeId,
        address token,
        address recipient,
        uint256 amount,
        uint256 sourceChain,
        bytes32 sourceTxHash
    ) external returns (bool);
    
    function refundBridge(bytes32 bridgeId, string calldata reason) external returns (bool);

    // Chain management
    function addSupportedChain(uint256 chainId) external;
    function removeSupportedChain(uint256 chainId) external;
    function setChainGateway(uint256 chainId, address gateway) external;
    function setChainLimits(uint256 chainId, uint256 minAmount, uint256 maxAmount) external;

    // Fee management
    function setBridgeFee(uint256 fee) external;
    function collectFees(address token) external;
    function withdrawFees(address token, address to, uint256 amount) external;

    // Security
    function pauseBridging() external;
    function unpauseBridging() external;
    function setGuardian(address guardian) external;
    function emergencyHalt() external;
    function resumeOperations() external;

    // Verification
    function verifyBridgeProof(
        bytes32 bridgeId,
        bytes calldata proof,
        bytes32 root
    ) external view returns (bool);
}
