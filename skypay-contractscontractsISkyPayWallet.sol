// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ISkyPayWallet {
    // Events
    event TransactionExecuted(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        bytes data,
        bool success,
        bytes result
    );
    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);
    event RecoveryInitiated(address indexed newOwner, uint256 unlockTime);
    event RecoveryCompleted(address indexed newOwner);
    event DailyLimitUpdated(uint256 oldLimit, uint256 newLimit);
    event SessionKeyAdded(address indexed sessionKey, uint256 expiry);
    event SessionKeyRemoved(address indexed sessionKey);

    // Structs
    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        uint256 nonce;
        uint256 deadline;
    }

    struct RecoveryRequest {
        address newOwner;
        uint256 unlockTime;
        uint256 confirmations;
        mapping(address => bool) guardiansConfirmed;
    }

    // View functions
    function getNonce() external view returns (uint256);
    function getGuardians() external view returns (address[] memory);
    function isGuardian(address account) external view returns (bool);
    function getDailyLimit() external view returns (uint256);
    function getDailySpent() external view returns (uint256);
    function getRecoveryRequest() external view returns (address newOwner, uint256 unlockTime, uint256 confirmations);
    function hasConfirmedRecovery(address guardian) external view returns (bool);
    function getSessionKeyExpiry(address sessionKey) external view returns (uint256);
    function isValidSessionKey(address sessionKey) external view returns (bool);
    function getTransactionHash(Transaction calldata transaction) external view returns (bytes32);
    function verifySignature(bytes32 hash, bytes calldata signature) external view returns (bool);

    // Transaction functions
    function executeTransaction(
        Transaction calldata transaction,
        bytes calldata signature
    ) external payable returns (bytes memory);
    
    function executeBatch(
        Transaction[] calldata transactions,
        bytes[] calldata signatures
    ) external payable returns (bytes[] memory);
    
    function executeTransactionWithSession(
        Transaction calldata transaction,
        address sessionKey
    ) external payable returns (bytes memory);

    // Guardian management
    function addGuardian(address guardian) external;
    function removeGuardian(address guardian) external;
    function proposeGuardianChange(address[] calldata newGuardians) external;
    function confirmGuardianChange() external;

    // Recovery functions
    function initiateRecovery(address newOwner) external;
    function confirmRecovery() external;
    function cancelRecovery() external;
    function completeRecovery() external;

    // Session keys
    function addSessionKey(address sessionKey, uint256 expiry) external;
    function removeSessionKey(address sessionKey) external;
    function extendSessionKey(address sessionKey, uint256 newExpiry) external;

    // Settings
    function setDailyLimit(uint256 newLimit) external;
    function resetDailySpent() external;

    // Emergency
    function emergencyPause() external;
    function emergencyUnpause() external;
}
