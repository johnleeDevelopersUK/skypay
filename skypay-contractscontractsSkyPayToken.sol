// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SkyPay Token
 * @dev Multi-chain stablecoin with compliance features
 */
contract SkyPayToken is 
    ERC20, 
    ERC20Burnable, 
    ERC20Pausable, 
    ERC20Snapshot, 
    AccessControl,
    ReentrancyGuard 
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    // Token details
    string private _tokenName;
    string private _tokenSymbol;
    uint8 private _decimals;
    
    // Peg information
    string public pegCurrency;
    uint256 public pegRatio; // 1:1 = 1e18
    
    // Compliance features
    mapping(address => bool) public blacklisted;
    mapping(address => uint256) public dailySpendLimit;
    mapping(address => uint256) public monthlySpendLimit;
    mapping(address => uint256) public lastTransferDate;
    mapping(address => mapping(uint256 => uint256)) public dailySpent;
    mapping(address => mapping(uint256 => uint256)) public monthlySpent;
    
    // Bridge integration
    mapping(address => bool) public isBridge;
    uint256 public bridgeMintLimit;
    uint256 public totalBridged;
    
    // Events
    event Minted(address indexed to, uint256 amount, string indexed reference);
    event Burned(address indexed from, uint256 amount, string indexed reference);
    event Blacklisted(address indexed account, bool status);
    event LimitUpdated(address indexed account, uint256 daily, uint256 monthly);
    event BridgeConfigured(address indexed bridge, bool status);
    event BridgedIn(address indexed from, uint256 amount, uint256 indexed sourceChain);
    event BridgedOut(address indexed to, uint256 amount, uint256 indexed destChain);
    
    // Struct for transaction metadata
    struct TransactionMeta {
        address from;
        address to;
        uint256 amount;
        uint256 timestamp;
        string reference;
        bytes32 complianceHash;
    }
    
    mapping(bytes32 => TransactionMeta) public transactions;
    
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        string memory pegCurrency_,
        uint256 initialSupply,
        address admin
    ) ERC20(name_, symbol_) {
        _tokenName = name_;
        _tokenSymbol = symbol_;
        _decimals = decimals_;
        pegCurrency = pegCurrency_;
        pegRatio = 1e18; // 1:1 peg
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, admin);
        
        if (initialSupply > 0) {
            _mint(admin, initialSupply * 10 ** decimals_);
        }
    }
    
    /**
     * @dev Returns the name of the token.
     */
    function name() public view virtual override returns (string memory) {
        return _tokenName;
    }
    
    /**
     * @dev Returns the symbol of the token.
     */
    function symbol() public view virtual override returns (string memory) {
        return _tokenSymbol;
    }
    
    /**
     * @dev Returns the number of decimals used to get its user representation.
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Mint new tokens (only for minters)
     */
    function mint(
        address to, 
        uint256 amount, 
        string memory reference
    ) external onlyRole(MINTER_ROLE) nonReentrant returns (bool) {
        require(to != address(0), "Mint to zero address");
        require(amount > 0, "Amount must be positive");
        
        _mint(to, amount);
        emit Minted(to, amount, reference);
        return true;
    }
    
    /**
     * @dev Burn tokens from any address (only for minters or token holder)
     */
    function burn(
        address from, 
        uint256 amount, 
        string memory reference
    ) external nonReentrant returns (bool) {
        require(
            msg.sender == from || hasRole(MINTER_ROLE, msg.sender),
            "Not authorized to burn"
        );
        require(amount > 0, "Amount must be positive");
        require(balanceOf(from) >= amount, "Insufficient balance");
        
        _burn(from, amount);
        emit Burned(from, amount, reference);
        return true;
    }
    
    /**
     * @dev Bridge mint function (for cross-chain transfers)
     */
    function bridgeMint(
        address to,
        uint256 amount,
        uint256 sourceChain,
        bytes32 transactionHash
    ) external onlyRole(BRIDGE_ROLE) nonReentrant returns (bool) {
        require(isBridge[msg.sender], "Caller not a bridge");
        require(to != address(0), "Mint to zero address");
        require(amount > 0, "Amount must be positive");
        require(totalBridged + amount <= bridgeMintLimit, "Exceeds bridge limit");
        
        totalBridged += amount;
        _mint(to, amount);
        
        emit BridgedIn(to, amount, sourceChain);
        
        // Store transaction metadata
        transactions[transactionHash] = TransactionMeta({
            from: address(0),
            to: to,
            amount: amount,
            timestamp: block.timestamp,
            reference: string(abi.encodePacked("BRIDGE_IN_", transactionHash)),
            complianceHash: keccak256(abi.encodePacked(to, amount, sourceChain))
        });
        
        return true;
    }
    
    /**
     * @dev Bridge burn function (for cross-chain transfers)
     */
    function bridgeBurn(
        address from,
        uint256 amount,
        uint256 destChain,
        bytes32 transactionHash
    ) external onlyRole(BRIDGE_ROLE) nonReentrant returns (bool) {
        require(isBridge[msg.sender], "Caller not a bridge");
        require(from != address(0), "Burn from zero address");
        require(amount > 0, "Amount must be positive");
        require(balanceOf(from) >= amount, "Insufficient balance");
        
        totalBridged -= amount;
        _burn(from, amount);
        
        emit BridgedOut(from, amount, destChain);
        
        // Store transaction metadata
        transactions[transactionHash] = TransactionMeta({
            from: from,
            to: address(0),
            amount: amount,
            timestamp: block.timestamp,
            reference: string(abi.encodePacked("BRIDGE_OUT_", transactionHash)),
            complianceHash: keccak256(abi.encodePacked(from, amount, destChain))
        });
        
        return true;
    }
    
    /**
     * @dev Configure bridge address
     */
    function setBridge(
        address bridge, 
        bool status
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        isBridge[bridge] = status;
        if (status) {
            _grantRole(BRIDGE_ROLE, bridge);
        } else {
            _revokeRole(BRIDGE_ROLE, bridge);
        }
        emit BridgeConfigured(bridge, status);
    }
    
    /**
     * @dev Set bridge mint limit
     */
    function setBridgeMintLimit(
        uint256 newLimit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bridgeMintLimit = newLimit;
    }
    
    /**
     * @dev Blacklist/unblacklist an address
     */
    function setBlacklist(
        address account, 
        bool status
    ) external onlyRole(COMPLIANCE_ROLE) {
        blacklisted[account] = status;
        emit Blacklisted(account, status);
    }
    
    /**
     * @dev Set spending limits for an address
     */
    function setSpendingLimits(
        address account,
        uint256 daily,
        uint256 monthly
    ) external onlyRole(COMPLIANCE_ROLE) {
        dailySpendLimit[account] = daily;
        monthlySpendLimit[account] = monthly;
        emit LimitUpdated(account, daily, monthly);
    }
    
    /**
     * @dev Check if transfer is allowed
     */
    function isTransferAllowed(
        address from,
        address to,
        uint256 amount
    ) public view returns (bool, string memory) {
        // Check blacklist
        if (blacklisted[from] || blacklisted[to]) {
            return (false, "Address blacklisted");
        }
        
        // Check daily limit
        uint256 today = block.timestamp / 1 days;
        if (dailySpendLimit[from] > 0) {
            uint256 spentToday = dailySpent[from][today];
            if (spentToday + amount > dailySpendLimit[from]) {
                return (false, "Exceeds daily limit");
            }
        }
        
        // Check monthly limit
        uint256 thisMonth = block.timestamp / 30 days;
        if (monthlySpendLimit[from] > 0) {
            uint256 spentThisMonth = monthlySpent[from][thisMonth];
            if (spentThisMonth + amount > monthlySpendLimit[from]) {
                return (false, "Exceeds monthly limit");
            }
        }
        
        return (true, "");
    }
    
    /**
     * @dev Override transfer with compliance checks
     */
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override nonReentrant {
        require(!paused(), "Token transfers paused");
        
        // Check compliance
        (bool allowed, string memory reason) = isTransferAllowed(from, to, amount);
        require(allowed, reason);
        
        // Update spending tracking
        uint256 today = block.timestamp / 1 days;
        uint256 thisMonth = block.timestamp / 30 days;
        
        dailySpent[from][today] += amount;
        monthlySpent[from][thisMonth] += amount;
        lastTransferDate[from] = block.timestamp;
        
        // Execute transfer
        super._transfer(from, to, amount);
    }
    
    /**
     * @dev Override transferFrom with compliance checks
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override nonReentrant returns (bool) {
        require(!paused(), "Token transfers paused");
        
        // Check compliance
        (bool allowed, string memory reason) = isTransferAllowed(from, to, amount);
        require(allowed, reason);
        
        // Update spending tracking
        uint256 today = block.timestamp / 1 days;
        uint256 thisMonth = block.timestamp / 30 days;
        
        dailySpent[from][today] += amount;
        monthlySpent[from][thisMonth] += amount;
        lastTransferDate[from] = block.timestamp;
        
        return super.transferFrom(from, to, amount);
    }
    
    /**
     * @dev Pause all token transfers
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Create a snapshot of token balances
     */
    function snapshot() external onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256) {
        return _snapshot();
    }
    
    /**
     * @dev Get transaction metadata
     */
    function getTransaction(
        bytes32 transactionHash
    ) external view returns (TransactionMeta memory) {
        return transactions[transactionHash];
    }
    
    /**
     * @dev Get current daily spent amount
     */
    function getDailySpent(
        address account
    ) external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        return dailySpent[account][today];
    }
    
    /**
     * @dev Get current monthly spent amount
     */
    function getMonthlySpent(
        address account
    ) external view returns (uint256) {
        uint256 thisMonth = block.timestamp / 30 days;
        return monthlySpent[account][thisMonth];
    }
    
    /**
     * @dev Get remaining daily limit
     */
    function getRemainingDailyLimit(
        address account
    ) external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        uint256 spent = dailySpent[account][today];
        uint256 limit = dailySpendLimit[account];
        return limit > spent ? limit - spent : 0;
    }
    
    /**
     * @dev Get remaining monthly limit
     */
    function getRemainingMonthlyLimit(
        address account
    ) external view returns (uint256) {
        uint256 thisMonth = block.timestamp / 30 days;
        uint256 spent = monthlySpent[account][thisMonth];
        uint256 limit = monthlySpendLimit[account];
        return limit > spent ? limit - spent : 0;
    }
    
    // The following functions are overrides required by Solidity.
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Pausable, ERC20Snapshot) {
        super._beforeTokenTransfer(from, to, amount);
    }
}
