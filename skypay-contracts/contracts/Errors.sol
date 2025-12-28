// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library Errors {
    // General errors
    error Unauthorized();
    error InvalidAddress();
    error InvalidAmount();
    error InsufficientBalance();
    error InsufficientAllowance();
    error TransferFailed();
    error TransferFromFailed();
    error ApprovalFailed();
    
    // Vault errors
    error TokenNotSupported();
    error TokenAlreadyAdded();
    error InsufficientShares();
    error WithdrawalTooEarly();
    error WithdrawalFeeTooHigh();
    error StrategyNotActive();
    error StrategyAlreadyAdded();
    error InsufficientLiquidity();
    error EmergencyModeActive();
    error NotInEmergencyMode();
    
    // Router errors
    error InvalidRoute();
    RouteNotFound();
    error SlippageExceeded();
    error DeadlineExceeded();
    error InsufficientOutput();
    error SwapPaused();
    
    // Wallet errors
    error InvalidNonce();
    error InvalidSignature();
    error SignatureExpired();
    error DailyLimitExceeded();
    error GuardianRequired();
    error RecoveryNotInitiated();
    error RecoveryInProgress();
    error RecoveryTimeNotElapsed();
    error SessionKeyExpired();
    error InvalidSessionKey();
    error WalletPaused();
    
    // Compliance errors
    error SanctionedAddress();
    error PEPAddress();
    error HighRiskCountry();
    error TransactionFlagged();
    error RequiresComplianceReview();
    error ComplianceOverrideRequired();
    error SARAlreadyGenerated();
    
    // Relayer errors
    error NotRelayer();
    error InsufficientGasBalance();
    error InvalidGasLimit();
    error RelayFailed(bytes result);
    error RelayingPaused();
    error InvalidSignatureLength();
    error InvalidSignatureV();
    
    // Liquidity pool errors
    error PoolInactive();
    error InvalidSwapPair();
    error PriceImpactTooHigh();
    error FeeTooHigh();
    error SlippageTooHigh();
    error MaxSlippageExceeded();
    
    // Bridge errors
    error ChainNotSupported();
    error ChainAlreadySupported();
    error AmountBelowMinimum();
    error AmountAboveMaximum();
    error InvalidBridgeState();
    error HashAlreadyProcessed();
    error RefundTooEarly();
    error BridgePaused();
    error NotGuardian();
    
    // Governance errors
    error ProposalFailed();
    error VotingNotActive();
    error AlreadyVoted();
    error QuorumNotMet();
    error ProposalNotExecutable();
    error TimelockNotElapsed();
    
    // Signature errors
    error InvalidRecoveredAddress();
    error SignerMismatch();
    error EIP712DomainMismatch();
    
    // Math errors
    error DivisionByZero();
    error Overflow();
    error Underflow();
    error InvalidPrecision();
    
    // Time errors
    error ExpiredDeadline();
    error TooEarly();
    error InvalidTimestamp();
}
