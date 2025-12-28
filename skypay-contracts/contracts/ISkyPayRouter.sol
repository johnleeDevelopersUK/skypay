// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ISkyPayRouter {
    // Events
    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );
    event RouteAdded(address indexed routeId, address indexed handler);
    event RouteRemoved(address indexed routeId);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event SlippageUpdated(address indexed user, uint256 slippage);

    // Structs
    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOutMin;
        address recipient;
        uint256 deadline;
        bytes routeData;
    }

    struct Route {
        address handler;
        bool active;
        uint256 priority;
    }

    // View functions
    function getBestRoute(address tokenIn, address tokenOut, uint256 amountIn) 
        external view returns (address handler, uint256 amountOut, bytes memory data);
    function calculateSwap(address tokenIn, address tokenOut, uint256 amountIn) 
        external view returns (uint256 amountOut);
    function getSwapFee() external view returns (uint256);
    function getRoutes() external view returns (bytes32[] memory, Route[] memory);
    function getUserSlippage(address user) external view returns (uint256);
    function estimateGasForSwap(SwapParams calldata params) external view returns (uint256);

    // Swap functions
    function swap(SwapParams calldata params) external payable returns (uint256 amountOut);
    function swapWithPermit(
        SwapParams calldata params,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 amountOut);
    function swapAndDeposit(
        SwapParams calldata params,
        address vault
    ) external returns (uint256 shares);
    function swapAndBridge(
        SwapParams calldata params,
        address bridge,
        uint256 chainId
    ) external returns (bytes32 bridgeId);

    // Route management
    function addRoute(bytes32 routeId, address handler, uint256 priority) external;
    function removeRoute(bytes32 routeId) external;
    function updateRoutePriority(bytes32 routeId, uint256 priority) external;
    function setSwapFee(uint256 fee) external;
    function setSlippage(uint256 slippage) external;
    
    // Emergency functions
    function pauseSwaps() external;
    function unpauseSwaps() external;
    function rescueETH(address to, uint256 amount) external;
}
