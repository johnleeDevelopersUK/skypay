// skypay-contracts/contracts/Vault.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title SkyPay Vault
 * @notice Secure vault for managing token-backed stablecoins with compliance controls
 */
contract Vault is AccessControl, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    // Roles
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");
    
    // Token contract
    IERC20 public stablecoin;
    
    // State tracking
    struct Settlement {
        bytes32 id;
        address user;
        uint256 amount;
        string currency;
        SettlementStatus status;
        uint256 createdAt;
        uint256 completedAt;
        string externalReference;
    }
    
    enum SettlementStatus {
        PENDING,
        MINTED,
        BURNED,
        CANCELLED,
        FAILED
    }
    
    // Mappings
    mapping(bytes32 => Settlement) public settlements;
    mapping(address => uint256) public userMinted;
    mapping(address => uint256) public userBurned;
    mapping(address => bool) public frozenAccounts;
    
    // Events
    event SettlementCreated(
        bytes32 indexed settlementId,
        address indexed user,
        uint256 amount,
        string currency,
        string externalReference
    );
    
    event TokensMinted(
        bytes32 indexed settlementId,
        address indexed user,
        uint256 amount,
        string currency,
        string transactionHash
    );
    
    event TokensBurned(
        bytes32 indexed settlementId,
        address indexed user,
        uint256 amount,
        string currency,
        string transactionHash
    );
    
    event SettlementCompleted(
        bytes32 indexed settlementId,
        address indexed user,
        SettlementStatus status
    );
    
    event AccountFrozen(address indexed account, address indexed by);
    event AccountUnfrozen(address indexed account, address indexed by);
    
    // Counters
    Counters.Counter private _settlementCounter;
    
    constructor(address _stablecoin) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        _grantRole(COMPLIANCE_ROLE, msg.sender);
        _grantRole(SETTLEMENT_ROLE, msg.sender);
        
        stablecoin = IERC20(_stablecoin);
    }
    
    /**
     * @notice Create a new settlement for token minting
     * @param settlementId Unique settlement identifier
     * @param user User address to receive tokens
     * @param amount Amount of tokens to mint
     * @param currency Currency code (e.g., "USDX")
     * @param externalReference External reference ID
     */
    function createSettlement(
        bytes32 settlementId,
        address user,
        uint256 amount,
        string calldata currency,
        string calldata externalReference
    ) external onlyRole(SETTLEMENT_ROLE) returns (bytes32) {
        require(settlements[settlementId].user == address(0), "Settlement already exists");
        require(!frozenAccounts[user], "User account is frozen");
        require(amount > 0, "Amount must be positive");
        
        settlements[settlementId] = Settlement({
            id: settlementId,
            user: user,
            amount: amount,
            currency: currency,
            status: SettlementStatus.PENDING,
            createdAt: block.timestamp,
            completedAt: 0,
            externalReference: externalReference
        });
        
        _settlementCounter.increment();
        
        emit SettlementCreated(
            settlementId,
            user,
            amount,
            currency,
            externalReference
        );
        
        return settlementId;
    }
    
    /**
     * @notice Mint tokens for a settlement
     * @param settlementId Settlement identifier
     * @param transactionHash External transaction hash
     */
    function mintForSettlement(
        bytes32 settlementId,
        string calldata transactionHash
    ) external nonReentrant onlyRole(MINTER_ROLE) {
        Settlement storage settlement = settlements[settlementId];
        
        require(settlement.user != address(0), "Settlement not found");
        require(settlement.status == SettlementStatus.PENDING, "Invalid settlement status");
        require(!frozenAccounts[settlement.user], "User account is frozen");
        
        // Update settlement status
        settlement.status = SettlementStatus.MINTED;
        settlement.completedAt = block.timestamp;
        
        // Update user stats
        userMinted[settlement.user] += settlement.amount;
        
        emit TokensMinted(
            settlementId,
            settlement.user,
            settlement.amount,
            settlement.currency,
            transactionHash
        );
        
        emit SettlementCompleted(settlementId, settlement.user, SettlementStatus.MINTED);
    }
    
    /**
     * @notice Create and process burn settlement
     * @param user User address burning tokens
     * @param amount Amount to burn
     * @param currency Currency code
     * @param externalReference External reference
     */
    function burnTokens(
        address user,
        uint256 amount,
        string calldata currency,
        string calldata externalReference
    ) external nonReentrant onlyRole(BURNER_ROLE) returns (bytes32) {
        require(!frozenAccounts[user], "User account is frozen");
        require(amount > 0, "Amount must be positive");
        require(
            stablecoin.balanceOf(user) >= amount,
            "Insufficient token balance"
        );
        
        // Create settlement ID
        bytes32 settlementId = keccak256(
            abi.encodePacked(
                user,
                amount,
                currency,
                externalReference,
                block.timestamp
            )
        );
        
        settlements[settlementId] = Settlement({
            id: settlementId,
            user: user,
            amount: amount,
            currency: currency,
            status: SettlementStatus.PENDING,
            createdAt: block.timestamp,
            completedAt: 0,
            externalReference: externalReference
        });
        
        // Transfer tokens from user to vault
        require(
            stablecoin.transferFrom(user, address(this), amount),
            "Token transfer failed"
        );
        
        // Update status
        settlements[settlementId].status = SettlementStatus.BURNED;
        settlements[settlementId].completedAt = block.timestamp;
        userBurned[user] += amount;
        
        emit TokensBurned(
            settlementId,
            user,
            amount,
            currency,
            externalReference
        );
        
        emit SettlementCompleted(settlementId, user, SettlementStatus.BURNED);
        
        return settlementId;
    }
    
    /**
     * @notice Get settlement details
     */
    function getSettlement(bytes32 settlementId)
        external
        view
        returns (
            address user,
            uint256 amount,
            string memory currency,
            SettlementStatus status,
            uint256 createdAt,
            string memory externalReference
        )
    {
        Settlement storage s = settlements[settlementId];
        return (
            s.user,
            s.amount,
            s.currency,
            s.status,
            s.createdAt,
            s.externalReference
        );
    }
    
    /**
     * @notice Freeze user account (compliance action)
     */
    function freezeAccount(address account) external onlyRole(COMPLIANCE_ROLE) {
        require(!frozenAccounts[account], "Account already frozen");
        frozenAccounts[account] = true;
        emit AccountFrozen(account, msg.sender);
    }
    
    /**
     * @notice Unfreeze user account
     */
    function unfreezeAccount(address account) external onlyRole(COMPLIANCE_ROLE) {
        require(frozenAccounts[account], "Account not frozen");
        frozenAccounts[account] = false;
        emit AccountUnfrozen(account, msg.sender);
    }
    
    /**
     * @notice Withdraw tokens from vault (admin only)
     */
    function withdrawTokens(
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(
            stablecoin.transfer(to, amount),
            "Token transfer failed"
        );
    }
    
    /**
     * @notice Get total settlements count
     */
    function getSettlementCount() external view returns (uint256) {
        return _settlementCounter.current();
    }
    
    /**
     * @notice Get user minting stats
     */
    function getUserStats(address user)
        external
        view
        returns (uint256 minted, uint256 burned)
    {
        return (userMinted[user], userBurned[user]);
    }
}
