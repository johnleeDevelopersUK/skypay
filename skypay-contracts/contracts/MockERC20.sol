// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Wrapper.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title MockERC20
 * @dev Mock ERC20 token for testing SkyPay ecosystem
 * Includes all standard ERC20 extensions plus test utilities
 */
contract MockERC20 is ERC20, ERC20Burnable, ERC20Permit, ERC20Votes, Ownable, Pausable {
    uint8 private _decimals;
    
    // Role for minting (for testing access control)
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    // Test-specific features
    bool public transferFeeEnabled;
    uint256 public transferFeeRate; // Basis points (1/100 of 1%)
    address public feeCollector;
    
    // Snapshot testing
    uint256 public currentSnapshotId;
    
    // Bridge testing
    bool public bridgeable;
    address public bridgeContract;
    
    // Compliance testing
    mapping(address => bool) public blacklisted;
    
    // Events for testing
    event MockMint(address indexed to, uint256 amount, string reason);
    event MockBurn(address indexed from, uint256 amount, string reason);
    event TransferFeeCharged(address indexed from, address indexed to, uint256 fee);
    event Blacklisted(address indexed account, bool status);
    event BridgeConfigured(address indexed bridge, bool status);
    event SnapshotCreated(uint256 snapshotId);
    
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) ERC20Permit(name) {
        _decimals = decimals_;
        transferFeeEnabled = false;
        transferFeeRate = 0;
        feeCollector = msg.sender;
        bridgeable = false;
        
        // Grant minter role to deployer for testing
        _transferOwnership(msg.sender);
    }
    
    /**
     * @dev Returns the number of decimals used to get its user representation.
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    // ============================ TEST UTILITIES ============================
    
    /**
     * @dev Mint tokens for testing purposes
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit MockMint(to, amount, "Test mint");
    }
    
    /**
     * @dev Mint tokens with custom reason for testing
     */
    function mintWithReason(address to, uint256 amount, string memory reason) external onlyOwner {
        _mint(to, amount);
        emit MockMint(to, amount, reason);
    }
    
    /**
     * @dev Batch mint for multiple accounts
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
        }
    }
    
    /**
     * @dev Burn tokens with custom reason for testing
     */
    function burnWithReason(address from, uint256 amount, string memory reason) external onlyOwner {
        _burn(from, amount);
        emit MockBurn(from, amount, reason);
    }
    
    /**
     * @dev Set transfer fee for testing fee mechanisms
     */
    function setTransferFee(uint256 rate, address collector) external onlyOwner {
        transferFeeRate = rate;
        feeCollector = collector;
    }
    
    /**
     * @dev Enable/disable transfer fee
     */
    function setTransferFeeEnabled(bool enabled) external onlyOwner {
        transferFeeEnabled = enabled;
    }
    
    /**
     * @dev Blacklist an address for testing compliance
     */
    function setBlacklisted(address account, bool status) external onlyOwner {
        blacklisted[account] = status;
        emit Blacklisted(account, status);
    }
    
    /**
     * @dev Configure bridge for testing cross-chain transfers
     */
    function setBridgeable(bool status, address bridge) external onlyOwner {
        bridgeable = status;
        bridgeContract = bridge;
        emit BridgeConfigured(bridge, status);
    }
    
    /**
     * @dev Create a snapshot for testing
     */
    function createSnapshot() external onlyOwner returns (uint256) {
        currentSnapshotId = _snapshot();
        emit SnapshotCreated(currentSnapshotId);
        return currentSnapshotId;
    }
    
    /**
     * @dev Get balance at snapshot for testing
     */
    function balanceOfAt(address account, uint256 snapshotId) external view returns (uint256) {
        return _balanceOfAt(account, snapshotId);
    }
    
    /**
     * @dev Get total supply at snapshot for testing
     */
    function totalSupplyAt(uint256 snapshotId) external view returns (uint256) {
        return _totalSupplyAt(snapshotId);
    }
    
    // ============================ OVERRIDES ============================
    
    /**
     * @dev Override transfer with test features (fee, blacklist)
     */
    function transfer(address to, uint256 amount) 
        public 
        virtual 
        override 
        whenNotPaused 
        returns (bool) 
    {
        _checkBlacklist(msg.sender, to);
        
        if (transferFeeEnabled && transferFeeRate > 0) {
            uint256 fee = (amount * transferFeeRate) / 10000;
            uint256 netAmount = amount - fee;
            
            // Transfer fee to collector
            if (fee > 0) {
                super.transfer(feeCollector, fee);
                emit TransferFeeCharged(msg.sender, feeCollector, fee);
            }
            
            return super.transfer(to, netAmount);
        }
        
        return super.transfer(to, amount);
    }
    
    /**
     * @dev Override transferFrom with test features
     */
    function transferFrom(address from, address to, uint256 amount) 
        public 
        virtual 
        override 
        whenNotPaused 
        returns (bool) 
    {
        _checkBlacklist(from, to);
        
        if (transferFeeEnabled && transferFeeRate > 0) {
            uint256 fee = (amount * transferFeeRate) / 10000;
            uint256 netAmount = amount - fee;
            
            // Transfer fee to collector
            if (fee > 0) {
                super.transferFrom(from, feeCollector, fee);
                emit TransferFeeCharged(from, feeCollector, fee);
            }
            
            return super.transferFrom(from, to, netAmount);
        }
        
        return super.transferFrom(from, to, amount);
    }
    
    /**
     * @dev Pause token transfers for testing emergency scenarios
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============================ INTERNAL FUNCTIONS ============================
    
    /**
     * @dev Check if either sender or receiver is blacklisted
     */
    function _checkBlacklist(address from, address to) internal view {
        require(!blacklisted[from], "MockERC20: sender blacklisted");
        require(!blacklisted[to], "MockERC20: receiver blacklisted");
    }
    
    // ============================ HOOK OVERRIDES ============================
    
    /**
     * @dev Override _mint to include votes
     */
    function _mint(address account, uint256 amount) internal virtual override(ERC20, ERC20Votes) {
        super._mint(account, amount);
    }
    
    /**
     * @dev Override _burn to include votes
     */
    function _burn(address account, uint256 amount) internal virtual override(ERC20, ERC20Votes) {
        super._burn(account, amount);
    }
    
    /**
     * @dev Override _beforeTokenTransfer for pausing
     */
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        virtual
        override
    {
        super._beforeTokenTransfer(from, to, amount);
        
        require(!paused(), "MockERC20: token transfer while paused");
    }
    
    /**
     * @dev Override _afterTokenTransfer for votes
     */
    function _afterTokenTransfer(address from, address to, uint256 amount)
        internal
        virtual
        override(ERC20, ERC20Votes)
    {
        super._afterTokenTransfer(from, to, amount);
    }
}

/**
 * @title MockStablecoin
 * @dev Mock stablecoin with pegging simulation for testing
 */
contract MockStablecoin is MockERC20 {
    string public pegCurrency;
    uint256 public pegPrice; // Price in USD * 1e18
    
    event PegUpdated(string currency, uint256 oldPrice, uint256 newPrice);
    
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        string memory pegCurrency_,
        uint256 initialPrice
    ) MockERC20(name, symbol, decimals_) {
        pegCurrency = pegCurrency_;
        pegPrice = initialPrice;
    }
    
    /**
     * @dev Update peg price for testing price fluctuations
     */
    function updatePegPrice(uint256 newPrice) external onlyOwner {
        uint256 oldPrice = pegPrice;
        pegPrice = newPrice;
        emit PegUpdated(pegCurrency, oldPrice, newPrice);
    }
    
    /**
     * @dev Simulate depegging event for testing
     */
    function simulateDepeg(uint256 deviationPercent) external onlyOwner {
        uint256 deviation = pegPrice * deviationPercent / 100;
        pegPrice = pegPrice - deviation;
        emit PegUpdated(pegCurrency, pegPrice + deviation, pegPrice);
    }
}

/**
 * @title MockWrappedToken
 * @dev Mock wrapped token for testing bridging
 */
contract MockWrappedToken is MockERC20, ERC20Wrapper {
    IERC20 public underlying;
    
    event Wrapped(address indexed account, uint256 amount);
    event Unwrapped(address indexed account, uint256 amount);
    
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        IERC20 underlyingToken
    ) MockERC20(name, symbol, decimals_) ERC20Wrapper(underlyingToken) {
        underlying = underlyingToken;
    }
    
    /**
     * @dev Wrap underlying tokens for testing
     */
    function wrap(uint256 amount) external returns (bool) {
        underlying.transferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);
        emit Wrapped(msg.sender, amount);
        return true;
    }
    
    /**
     * @dev Unwrap tokens for testing
     */
    function unwrap(uint256 amount) external returns (bool) {
        _burn(msg.sender, amount);
        underlying.transfer(msg.sender, amount);
        emit Unwrapped(msg.sender, amount);
        return true;
    }
    
    /**
     * @dev Get conversion rate for testing
     */
    function getConversionRate() external view returns (uint256) {
        return 1 * 10**decimals(); // 1:1 conversion
    }
}

/**
 * @title MockRebasingToken
 * @dev Mock token with rebasing for testing yield mechanisms
 */
contract MockRebasingToken is MockERC20 {
    uint256 public rebaseIndex; // 1e18 = 1.0
    uint256 public lastRebase;
    uint256 public rebaseRate; // Annual rate in basis points
    
    event Rebased(uint256 oldIndex, uint256 newIndex, uint256 timestamp);
    
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 initialRebaseRate
    ) MockERC20(name, symbol, decimals_) {
        rebaseIndex = 1e18;
        lastRebase = block.timestamp;
        rebaseRate = initialRebaseRate;
    }
    
    /**
     * @dev Execute rebase for testing
     */
    function rebase() external onlyOwner {
        uint256 timeElapsed = block.timestamp - lastRebase;
        uint256 periods = timeElapsed / 1 days;
        
        if (periods == 0) return;
        
        uint256 oldIndex = rebaseIndex;
        
        // Calculate new index: (1 + rate/36500)^periods
        for (uint256 i = 0; i < periods; i++) {
            rebaseIndex = rebaseIndex * (1e18 + rebaseRate * 1e14 / 365) / 1e18;
        }
        
        lastRebase = block.timestamp;
        emit Rebased(oldIndex, rebaseIndex, block.timestamp);
    }
    
    /**
     * @dev Get adjusted balance for testing
     */
    function adjustedBalanceOf(address account) external view returns (uint256) {
        return balanceOf(account) * rebaseIndex / 1e18;
    }
    
    /**
     * @dev Set rebase rate for testing
     */
    function setRebaseRate(uint256 newRate) external onlyOwner {
        rebaseRate = newRate;
    }
}

/**
 * @title MockERC20Factory
 * @dev Factory for creating mock tokens for testing
 */
contract MockERC20Factory {
    struct TokenInfo {
        address token;
        string name;
        string symbol;
        uint8 decimals;
        address owner;
        uint256 createdAt;
    }
    
    TokenInfo[] public tokens;
    
    event TokenCreated(
        address indexed token,
        string name,
        string symbol,
        uint8 decimals,
        address indexed owner
    );
    
    /**
     * @dev Create a standard mock token
     */
    function createToken(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) external returns (address) {
        MockERC20 token = new MockERC20(name, symbol, decimals);
        token.transferOwnership(msg.sender);
        
        tokens.push(TokenInfo({
            token: address(token),
            name: name,
            symbol: symbol,
            decimals: decimals,
            owner: msg.sender,
            createdAt: block.timestamp
        }));
        
        emit TokenCreated(address(token), name, symbol, decimals, msg.sender);
        return address(token);
    }
    
    /**
     * @dev Create a mock stablecoin
     */
    function createStablecoin(
        string memory name,
        string memory symbol,
        uint8 decimals,
        string memory pegCurrency,
        uint256 initialPrice
    ) external returns (address) {
        MockStablecoin token = new MockStablecoin(
            name,
            symbol,
            decimals,
            pegCurrency,
            initialPrice
        );
        token.transferOwnership(msg.sender);
        
        tokens.push(TokenInfo({
            token: address(token),
            name: name,
            symbol: symbol,
            decimals: decimals,
            owner: msg.sender,
            createdAt: block.timestamp
        }));
        
        emit TokenCreated(address(token), name, symbol, decimals, msg.sender);
        return address(token);
    }
    
    /**
     * @dev Create multiple tokens at once for batch testing
     */
    function createMultipleTokens(
        string[] memory names,
        string[] memory symbols,
        uint8[] memory decimalsArray
    ) external returns (address[] memory) {
        require(
            names.length == symbols.length && 
            symbols.length == decimalsArray.length,
            "Arrays length mismatch"
        );
        
        address[] memory created = new address[](names.length);
        
        for (uint256 i = 0; i < names.length; i++) {
            created[i] = createToken(names[i], symbols[i], decimalsArray[i]);
        }
        
        return created;
    }
    
    /**
     * @dev Get all created tokens
     */
    function getAllTokens() external view returns (TokenInfo[] memory) {
        return tokens;
    }
    
    /**
     * @dev Get tokens created by specific owner
     */
    function getTokensByOwner(address owner) external view returns (TokenInfo[] memory) {
        uint256 count = 0;
        
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i].owner == owner) {
                count++;
            }
        }
        
        TokenInfo[] memory result = new TokenInfo[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i].owner == owner) {
                result[index] = tokens[i];
                index++;
            }
        }
        
        return result;
    }
}
