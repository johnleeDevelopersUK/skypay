// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../utils/Errors.sol";
import "../utils/SafeTransfer.sol";
import "../interfaces/ILiquidityPool.sol";

contract LiquidityPool is ILiquidityPool, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using Math for uint256;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public swapFee = 30; // 0.3%
    uint256 public maxSlippage = 500; // 5%
    address public feeCollector;

    mapping(address => PoolInfo) public pools;
    mapping(address => mapping(address => ProviderInfo)) public providers;
    mapping(address => bool) public supportedTokens;
    address[] public tokenList;

    address public oracle;

    modifier onlySupportedToken(address token) {
        if (!supportedTokens[token]) revert Errors.TokenNotSupported();
        _;
    }

    modifier onlyActivePool(address token) {
        if (pools[token].totalLiquidity == 0) revert Errors.PoolInactive();
        _;
    }

    constructor(address admin, address feeCollector_, address oracle_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
        
        feeCollector = feeCollector_;
        oracle = oracle_;
    }

    function addLiquidity(address token, uint256 amount) 
        external 
        override 
        nonReentrant 
        whenNotPaused 
        onlySupportedToken(token)
        returns (uint256 shares) 
    {
        if (amount == 0) revert Errors.InvalidAmount();
        
        PoolInfo storage pool = pools[token];
        ProviderInfo storage provider = providers[msg.sender][token];
        
        // Transfer tokens
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Calculate shares
        if (pool.totalShares == 0) {
            shares = amount;
        } else {
            shares = amount.mul(pool.totalShares).div(pool.totalLiquidity);
        }
        
        // Update state
        pool.totalLiquidity = pool.totalLiquidity.add(amount);
        pool.totalShares = pool.totalShares.add(shares);
        pool.lastUpdate = block.timestamp;
        
        provider.shares = provider.shares.add(shares);
        provider.lastDeposit = block.timestamp;
        
        emit LiquidityAdded(msg.sender, token, amount, shares);
        
        return shares;
    }

    function removeLiquidity(address token, uint256 shares) 
        external 
        override 
        nonReentrant 
        whenNotPaused 
        onlySupportedToken(token)
        onlyActivePool(token)
        returns (uint256 amount) 
    {
        if (shares == 0) revert Errors.InvalidAmount();
        
        PoolInfo storage pool = pools[token];
        ProviderInfo storage provider = providers[msg.sender][token];
        
        if (provider.shares < shares) revert Errors.InsufficientShares();
        
        // Calculate amount
        amount = shares.mul(pool.totalLiquidity).div(pool.totalShares);
        
        // Apply withdrawal fee if within 7 days
        uint256 fee = 0;
        if (block.timestamp < provider.lastDeposit + 7 days) {
            fee = amount.mul(100).div(FEE_DENOMINATOR); // 1% early withdrawal fee
            amount = amount.sub(fee);
            pool.accumulatedFees = pool.accumulatedFees.add(fee);
        }
        
        // Update state
        pool.totalLiquidity = pool.totalLiquidity.sub(amount.add(fee));
        pool.totalShares = pool.totalShares.sub(shares);
        pool.lastUpdate = block.timestamp;
        
        provider.shares = provider.shares.sub(shares);
        
        // Transfer tokens
        IERC20(token).safeTransfer(msg.sender, amount);
        
        emit LiquidityRemoved(msg.sender, token, amount, shares);
        
        return amount;
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) 
        external 
        override 
        nonReentrant 
        whenNotPaused 
        returns (uint256 amountOut) 
    {
        if (!supportedTokens[tokenIn] || !supportedTokens[tokenOut]) {
            revert Errors.TokenNotSupported();
        }
        
        PoolInfo storage poolIn = pools[tokenIn];
        PoolInfo storage poolOut = pools[tokenOut];
        
        if (poolIn.totalLiquidity == 0 || poolOut.totalLiquidity == 0) {
            revert Errors.PoolInactive();
        }
        
        // Transfer tokens in
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Calculate swap
        uint256 fee = amountIn.mul(swapFee).div(FEE_DENOMINATOR);
        uint256 amountInAfterFee = amountIn.sub(fee);
        
        // Calculate amount out using constant product formula
        amountOut = _calculateSwapOut(
            poolIn.totalLiquidity,
            poolOut.totalLiquidity,
            amountInAfterFee
        );
        
        if (amountOut < minAmountOut) revert Errors.SlippageExceeded();
        
        // Check slippage
        uint256 spotPrice = poolOut.totalLiquidity.mul(1e18).div(poolIn.totalLiquidity);
        uint256 actualPrice = amountOut.mul(1e18).div(amountIn);
        uint256 slippage = spotPrice.sub(actualPrice).mul(FEE_DENOMINATOR).div(spotPrice);
        
        if (slippage > maxSlippage) revert Errors.SlippageExceeded();
        
        // Update pool balances
        poolIn.totalLiquidity = poolIn.totalLiquidity.add(amountIn);
        poolIn.accumulatedFees = poolIn.accumulatedFees.add(fee);
        poolIn.lastUpdate = block.timestamp;
        
        poolOut.totalLiquidity = poolOut.totalLiquidity.sub(amountOut);
        poolOut.lastUpdate = block.timestamp;
        
        // Transfer tokens out
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        
        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut, fee);
        
        return amountOut;
    }

    function calculateSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) 
        external 
        view 
        override 
        returns (uint256 amountOut, uint256 fee) 
    {
        if (!supportedTokens[tokenIn] || !supportedTokens[tokenOut]) {
            return (0, 0);
        }
        
        PoolInfo memory poolIn = pools[tokenIn];
        PoolInfo memory poolOut = pools[tokenOut];
        
        if (poolIn.totalLiquidity == 0 || poolOut.totalLiquidity == 0) {
            return (0, 0);
        }
        
        fee = amountIn.mul(swapFee).div(FEE_DENOMINATOR);
        uint256 amountInAfterFee = amountIn.sub(fee);
        
        amountOut = _calculateSwapOut(
            poolIn.totalLiquidity,
            poolOut.totalLiquidity,
            amountInAfterFee
        );
        
        return (amountOut, fee);
    }

    function _calculateSwapOut(
        uint256 liquidityIn,
        uint256 liquidityOut,
        uint256 amountIn
    ) private pure returns (uint256 amountOut) {
        uint256 numerator = amountIn.mul(liquidityOut);
        uint256 denominator = liquidityIn.add(amountIn);
        amountOut = numerator.div(denominator);
    }

    function collectFees(address token) 
        external 
        override 
        nonReentrant 
        onlyRole(MANAGER_ROLE) 
        returns (uint256) 
    {
        PoolInfo storage pool = pools[token];
        uint256 fees = pool.accumulatedFees;
        
        if (fees == 0) return 0;
        
        pool.accumulatedFees = 0;
        IERC20(token).safeTransfer(feeCollector, fees);
        
        emit FeesCollected(token, fees);
        
        return fees;
    }

    function claimFees(address token) 
        external 
        override 
        nonReentrant 
        onlyRole(MANAGER_ROLE) 
        returns (uint256) 
    {
        PoolInfo storage pool = pools[token];
        uint256 fees = pool.accumulatedFees;
        
        if (fees == 0) return 0;
        
        pool.accumulatedFees = 0;
        IERC20(token).safeTransfer(feeCollector, fees);
        
        return fees;
    }

    function addToken(address token, uint256 initialLiquidity) 
        external 
        override 
        onlyRole(ADMIN_ROLE) 
    {
        if (supportedTokens[token]) revert Errors.TokenAlreadyAdded();
        
        supportedTokens[token] = true;
        tokenList.push(token);
        
        if (initialLiquidity > 0) {
            IERC20(token).safeTransferFrom(msg.sender, address(this), initialLiquidity);
            pools[token] = PoolInfo({
                totalLiquidity: initialLiquidity,
                totalShares: initialLiquidity,
                virtualBalance: initialLiquidity,
                lastUpdate: block.timestamp,
                accumulatedFees: 0
            });
        }
    }

    function setSwapFee(uint256 fee) external override onlyRole(ADMIN_ROLE) {
        if (fee > 1000) revert Errors.FeeTooHigh(); // Max 10%
        uint256 oldFee = swapFee;
        swapFee = fee;
        emit ParametersUpdated(fee, maxSlippage);
    }

    function setMaxSlippage(uint256 slippage) external override onlyRole(ADMIN_ROLE) {
        if (slippage > 1000) revert Errors.SlippageTooHigh(); // Max 10%
        uint256 oldSlippage = maxSlippage;
        maxSlippage = slippage;
        emit ParametersUpdated(swapFee, slippage);
    }

    function pauseSwaps() external override onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpauseSwaps() external override onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function emergencyWithdraw(address token, uint256 shares) 
        external 
        override 
        nonReentrant 
        onlySupportedToken(token)
        returns (uint256) 
    {
        ProviderInfo storage provider = providers[msg.sender][token];
        
        if (provider.shares < shares) revert Errors.InsufficientShares();
        
        PoolInfo storage pool = pools[token];
        uint256 amount = shares.mul(pool.totalLiquidity).div(pool.totalShares);
        
        // Update state
        pool.totalLiquidity = pool.totalLiquidity.sub(amount);
        pool.totalShares = pool.totalShares.sub(shares);
        provider.shares = provider.shares.sub(shares);
        
        // Transfer tokens
        IERC20(token).safeTransfer(msg.sender, amount);
        
        return amount;
    }

    function getPoolInfo(address token) 
        external 
        view 
        override 
        returns (PoolInfo memory) 
    {
        return pools[token];
    }

    function getTotalValueLocked() 
        external 
        view 
        override 
        returns (uint256) 
    {
        uint256 total = 0;
        
        for (uint256 i = 0; i < tokenList.length; i++) {
            total = total.add(pools[tokenList[i]].totalLiquidity);
        }
        
        return total;
    }

    function getSupportedTokens() 
        external 
        view 
        override 
        returns (address[] memory) 
    {
        return tokenList;
    }

    function calculateShares(address token, uint256 amount) 
        external 
        view 
        override 
        returns (uint256) 
    {
        PoolInfo memory pool = pools[token];
        
        if (pool.totalShares == 0) {
            return amount;
        }
        
        return amount.mul(pool.totalShares).div(pool.totalLiquidity);
    }

    function calculateAmount(address token, uint256 shares) 
        external 
        view 
        override 
        returns (uint256) 
    {
        PoolInfo memory pool = pools[token];
        
        if (pool.totalShares == 0) {
            return 0;
        }
        
        return shares.mul(pool.totalLiquidity).div(pool.totalShares);
    }

    function getSpotPrice(address tokenIn, address tokenOut) 
        external 
        view 
        override 
        returns (uint256) 
    {
        PoolInfo memory poolIn = pools[tokenIn];
        PoolInfo memory poolOut = pools[tokenOut];
        
        if (poolIn.totalLiquidity == 0 || poolOut.totalLiquidity == 0) {
            return 0;
        }
        
        return poolOut.totalLiquidity.mul(1e18).div(poolIn.totalLiquidity);
    }
}
