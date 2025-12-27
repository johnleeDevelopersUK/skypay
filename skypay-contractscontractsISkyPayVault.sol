// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ISkyPayVault {
    // Events
    event TokenAdded(address indexed token, address indexed pool);
    event TokenRemoved(address indexed token);
    event Deposit(address indexed user, address indexed token, uint256 amount, uint256 shares);
    event Withdraw(address indexed user, address indexed token, uint256 amount, uint256 shares);
    event StrategyAdded(address indexed strategy);
    event StrategyRemoved(address indexed strategy);
    event FeeCollected(address indexed token, uint256 amount);
    event EmergencyModeActivated();
    event EmergencyModeDeactivated();

    // Structs
    struct TokenInfo {
        address pool;
        bool enabled;
        uint256 totalDeposits;
        uint256 totalShares;
        uint256 lastUpdate;
        uint256 performanceFee;
        uint256 withdrawalFee;
    }

    struct Strategy {
        address implementation;
        bool active;
        uint256 allocated;
        uint256 performance;
        uint256 lastHarvest;
    }

    // View functions
    function getTokenInfo(address token) external view returns (TokenInfo memory);
    function getSupportedTokens() external view returns (address[] memory);
    function getTotalValueLocked() external view returns (uint256);
    function getSharePrice(address token) external view returns (uint256);
    function getStrategies() external view returns (Strategy[] memory);
    function calculateShares(address token, uint256 amount) external view returns (uint256);
    function calculateAmount(address token, uint256 shares) external view returns (uint256);
    function getPendingRewards(address user) external view returns (address[] memory tokens, uint256[] memory amounts);

    // User functions
    function deposit(address token, uint256 amount) external returns (uint256 shares);
    function depositFor(address token, uint256 amount, address recipient) external returns (uint256 shares);
    function withdraw(address token, uint256 shares) external returns (uint256 amount);
    function withdrawAll(address token) external returns (uint256 amount);
    function claimRewards(address[] calldata tokens) external returns (uint256[] memory amounts);
    function migrate(address fromToken, address toToken, uint256 amount) external returns (uint256);

    // Admin functions
    function addToken(address token, address pool, uint256 performanceFee, uint256 withdrawalFee) external;
    function removeToken(address token) external;
    function updateFees(address token, uint256 performanceFee, uint256 withdrawalFee) external;
    function addStrategy(address strategy) external;
    function removeStrategy(address strategy) external;
    function allocateToStrategy(address strategy, address token, uint256 amount) external;
    function harvestFromStrategy(address strategy) external;
    function collectFees(address token) external;
    function setEmergencyMode(bool active) external;
    function rescueTokens(address token, address to, uint256 amount) external;
}
