// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IComplianceModule {
    // Events
    event SanctionAdded(address indexed entity, string reason);
    event SanctionRemoved(address indexed entity);
    event PEPAdded(address indexed entity, string country);
    event PEPRemoved(address indexed entity);
    event CountryRiskUpdated(string country, uint8 riskLevel);
    event TransactionFlagged(
        bytes32 indexed txHash,
        address indexed from,
        address indexed to,
        uint256 riskScore,
        string[] flags
    );
    event ComplianceOverride(bytes32 indexed txHash, address indexed overrider);

    // Structs
    struct RiskAssessment {
        uint256 riskScore; // 0-100
        string[] flags;
        bool requiresReview;
        bool isBlocked;
    }

    struct EntityInfo {
        bool isSanctioned;
        bool isPEP;
        string country;
        uint256 lastCheck;
        string[] tags;
    }

    // View functions
    function assessTransaction(
        address from,
        address to,
        uint256 amount,
        address token
    ) external view returns (RiskAssessment memory);
    
    function isSanctioned(address entity) external view returns (bool);
    function isPEP(address entity) external view returns (bool);
    function getCountryRisk(string calldata country) external view returns (uint8);
    function getEntityInfo(address entity) external view returns (EntityInfo memory);
    function getTransactionHistory(address entity) external view returns (bytes32[] memory);
    function getRiskScore(address entity) external view returns (uint256);
    function isWhitelisted(address entity) external view returns (bool);
    function isBlacklisted(address entity) external view returns (bool);
    function canTransfer(address from, address to, uint256 amount) external view returns (bool);

    // Risk management
    function addSanction(address entity, string calldata reason) external;
    function removeSanction(address entity) external;
    function addPEP(address entity, string calldata country) external;
    function removePEP(address entity) external;
    function setCountryRisk(string calldata country, uint8 riskLevel) external;
    function whitelistAddress(address entity) external;
    function blacklistAddress(address entity) external;
    function removeFromList(address entity) external;

    // Transaction handling
    function flagTransaction(
        bytes32 txHash,
        address from,
        address to,
        uint256 amount,
        string[] calldata flags
    ) external returns (uint256 riskScore);
    
    function overrideTransaction(bytes32 txHash) external;
    function reviewTransaction(bytes32 txHash, bool approved, string calldata notes) external;

    // Reporting
    function generateSAR(bytes32 txHash, string calldata details) external returns (bytes32 reportId);
    function getSAR(bytes32 reportId) external view returns (string memory details, uint256 timestamp);
    
    // Batch operations
    function batchAddSanctions(address[] calldata entities, string[] calldata reasons) external;
    function batchAddPEPs(address[] calldata entities, string[] calldata countries) external;
}
