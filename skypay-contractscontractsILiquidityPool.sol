// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ILiquidityPool {
    // Events
    event LiquidityAdded(
        address indexed provider,
        address indexed token,
        uint256 amount,
        uint256 shares
    );
    event LiquidityRemoved(
        address indexed provider,
        address indexed token,
        uint256 amount,
        uint256 shares
    );
    event Swap(
        address indexed trader,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );
    event FeesCollected(address indexed token, uint256 amount);
    event ParametersUpdated(uint256 fee, uint256 slippage);

    // Structs
    struct PoolInfo {
        uint256 totalLiquidity;
        uint256 totalShares;
        uint256 virtualBalance;
        uint256 lastUpdate;
        uint256 accumulatedFees;
    }

    struct ProviderInfo {
        uint256 shares;
        uint256 rewardDebt;
        uint256 lastDeposit;
    }

    // View functions
    function getPoolInfo(address token) external view returns (PoolInfo memory);
    function getProviderInfo(address provider, address token) external view returns (ProviderInfo memory);
    function calculateShares(address token, uint256 amount) external view returns (uint256);
    function calculateAmount(address token, uint256 shares) external view returns (uint256);
    function getSpotPrice(address tokenIn, address tokenOut) external view returns (uint256);
    function calculateSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut, uint256 fee);
    function getTotalValueLocked() external view returns (uint256);
    function getPendingFees(address token) external view returns (uint256);
    function getSupportedTokens() external view returns (address[] memory);

    // Liquidity provision
    function addLiquidity(address token, uint256 amount) external returns (uint256 shares);
    function addLiquidityWithPermit(
        address token,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 shares);
    function removeLiquidity(address token, uint256 shares) external returns (uint256 amount);
    function removeAllLiquidity(address token) external returns (uint256 amount);

    // Swap functions
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut);
    function swapWithPermit(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 amountOut);

    // Fee management
    function collectFees(address token) external returns (uint256);
    function claimFees(address token) external returns (uint256);
    function reinvestFees(address token) external returns (uint256 shares);

    // Admin functions
    function addToken(address token, uint256 initialLiquidity) external;
    function removeToken(address token) external;
    function setSwapFee(uint256 fee) external;
    function setMaxSlippage(uint256 slippage) external;
    function updateOracle(address oracle) external;
    function pauseSwaps() external;
    function unpauseSwaps() external;
    
    // Emergency
    function emergencyWithdraw(address token, uint256 shares) external returns (uint256);
    function rescueTokens(address token, address to, uint256 amount) external;
}
