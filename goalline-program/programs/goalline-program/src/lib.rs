use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program::invoke;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, MintTo, TransferChecked};
use borsh::BorshSerialize;

pub mod txline_types;
use txline_types::*;

declare_id!("7Ao2A14qmYxnERuFRcGhFqVgA1p55eKr5RLfjhR9gXm8");

/// The canonical TxLINE oracle program address on devnet.
/// Hard-coded so any settle_market CPI is forced to target the real program.
pub const TXLINE_PROGRAM_ID: &str = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";


#[program]
pub mod goalline_program {
    use super::*;

    pub fn initialize_mint(ctx: Context<InitializeMint>) -> Result<()> {
        msg!("USDC Faucet Mint initialized successfully!");
        Ok(())
    }

    pub fn request_faucet(ctx: Context<RequestFaucet>) -> Result<()> {
        msg!("Minting 1,000 test USDC to user...");
        let mint_amount = 1_000 * 1_000_000; // 1,000 USDC (6 decimals)
        
        let seeds = &[
            b"usdc-mint".as_ref(),
            &[ctx.bumps.mint],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.mint.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        
        token_interface::mint_to(cpi_ctx, mint_amount)?;
        
        msg!("Successfully minted 1,000 test USDC!");
        Ok(())
    }

    pub fn create_market(
        ctx: Context<CreateMarket>,
        fixture_id: i64,
        market_type: u8,
        closes_at: i64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        market.fixture_id = fixture_id;
        market.market_type = market_type;
        market.authority = ctx.accounts.authority.key();
        market.total_yes_amount = 0;
        market.total_no_amount = 0;
        market.is_settled = false;
        market.winner = None;
        market.closes_at = closes_at;
        market.bump = ctx.bumps.market;

        msg!("Market created for fixture: {}, type: {}", fixture_id, market_type);
        Ok(())
    }

    pub fn place_bet(
        ctx: Context<PlaceBet>,
        amount: u64,
        prediction: bool,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let market = &mut ctx.accounts.market;

        // Check if market has closed
        require!(
            clock.unix_timestamp < market.closes_at,
            GoalLineError::MarketClosed
        );
        require!(!market.is_settled, GoalLineError::MarketAlreadySettled);
        require!(amount > 0, GoalLineError::InvalidAmount);

        // If the bettor has already placed a bet, they cannot change their prediction.
        // Must validate BEFORE the token transfer to avoid locking funds on a failed check.
        let bet = &mut ctx.accounts.bet;
        if bet.amount > 0 {
            require!(bet.prediction == prediction, GoalLineError::CannotChangePrediction);
        }

        // Transfer bet tokens to vault
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.bettor_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.bettor.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token_interface::transfer_checked(cpi_ctx, amount, 6)?;

        // Update market pools
        if prediction {
            market.total_yes_amount = market.total_yes_amount.checked_add(amount).ok_or(GoalLineError::MathOverflow)?;
        } else {
            market.total_no_amount = market.total_no_amount.checked_add(amount).ok_or(GoalLineError::MathOverflow)?;
        }

        // Record user bet details
        bet.amount = bet.amount.checked_add(amount).ok_or(GoalLineError::MathOverflow)?;
        bet.prediction = prediction;
        bet.is_claimed = false;
        bet.bump = ctx.bumps.bet;

        msg!("Placed bet of {} on outcome {}", amount, prediction);
        Ok(())
    }

    pub fn settle_market(
        ctx: Context<SettleMarket>,
        ts: i64,
        fixture_summary: ScoresBatchSummary,
        fixture_proof: Vec<ProofNode>,
        main_tree_proof: Vec<ProofNode>,
        predicate: TraderPredicate,
        stat_a: StatTerm,
        stat_b: Option<StatTerm>,
        op: Option<BinaryExpression>,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(!market.is_settled, GoalLineError::MarketAlreadySettled);

        // Verify the daily_scores_merkle_roots is actually owned by the TxLINE program
        require_keys_eq!(
            *ctx.accounts.daily_scores_merkle_roots.owner,
            ctx.accounts.txline_program.key(),
            GoalLineError::InvalidOracleOwner
        );

        // Build the validation CPI call payload
        #[derive(BorshSerialize)]
        struct ValidateStatArgs {
            ts: i64,
            fixture_summary: ScoresBatchSummary,
            fixture_proof: Vec<ProofNode>,
            main_tree_proof: Vec<ProofNode>,
            predicate: TraderPredicate,
            stat_a: StatTerm,
            stat_b: Option<StatTerm>,
            op: Option<BinaryExpression>,
        }

        let mut data = Vec::new();
        // Method/Instruction discriminator for validate_stat
        data.extend_from_slice(&[107, 197, 232, 90, 191, 136, 105, 185]);
        
        let args = ValidateStatArgs {
            ts,
            fixture_summary,
            fixture_proof,
            main_tree_proof,
            predicate,
            stat_a,
            stat_b,
            op,
        };
        args.serialize(&mut data).map_err(|_| GoalLineError::SerializationError)?;

        // Execute manual CPI
        let accounts = vec![
            AccountMeta::new_readonly(ctx.accounts.daily_scores_merkle_roots.key(), false),
        ];
        
        let ix = Instruction {
            program_id: ctx.accounts.txline_program.key(),
            accounts,
            data,
        };

        msg!("Invoking TxLINE validation program...");
        invoke(&ix, &[
            ctx.accounts.daily_scores_merkle_roots.to_account_info(),
            ctx.accounts.txline_program.to_account_info(),
        ])?;

        // Read CPI return data
        let (key, return_data) = solana_program::program::get_return_data()
            .ok_or(GoalLineError::NoReturnData)?;

        require_keys_eq!(key, ctx.accounts.txline_program.key(), GoalLineError::InvalidOracleOwner);
        require!(return_data.len() == 1, GoalLineError::InvalidReturnDataLength);

        let validated_result = return_data[0] != 0;
        msg!("TxLINE verification result: {}", validated_result);

        // The market outcome is Yes (true) if the predicate succeeded, No (false) otherwise
        market.is_settled = true;
        market.winner = Some(validated_result);

        msg!("Market successfully settled. Winning outcome: {}", validated_result);
        Ok(())
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let market = &ctx.accounts.market;
        let bet = &mut ctx.accounts.bet;

        require!(market.is_settled, GoalLineError::MarketNotSettled);
        require!(!bet.is_claimed, GoalLineError::WinningsAlreadyClaimed);

        let winner = market.winner.ok_or(GoalLineError::MarketNotSettled)?;
        
        // Ensure bettor won
        require!(bet.prediction == winner, GoalLineError::BettorLost);

        // Calculate proportional winnings share
        // share = (user_bet / winning_pool) * total_pool
        let total_pool = market.total_yes_amount
            .checked_add(market.total_no_amount)
            .ok_or(GoalLineError::MathOverflow)?;

        let winning_pool = if winner {
            market.total_yes_amount
        } else {
            market.total_no_amount
        };

        require!(winning_pool > 0, GoalLineError::MathOverflow);

        let win_amount = (bet.amount as u128)
            .checked_mul(total_pool as u128)
            .ok_or(GoalLineError::MathOverflow)?
            .checked_div(winning_pool as u128)
            .ok_or(GoalLineError::MathOverflow)? as u64;

        msg!("Winner claiming {} USDC", win_amount);

        // Transfer funds from vault to winner
        let market_key = market.key();
        let vault_seeds = &[
            b"vault".as_ref(),
            market_key.as_ref(),
            &[ctx.bumps.vault],
        ];
        let signer_seeds = &[&vault_seeds[..]];

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.vault.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.bettor_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        token_interface::transfer_checked(cpi_ctx, win_amount, 6)?;

        bet.is_claimed = true;
        msg!("Successfully claimed {} USDC winnings!", win_amount);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(
        init,
        payer = authority,
        seeds = [b"usdc-mint"],
        bump,
        mint::decimals = 6,
        mint::authority = mint,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestFaucet<'info> {
    #[account(
        mut,
        seeds = [b"usdc-mint"],
        bump,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user,
        associated_token::token_program = token_program
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(fixture_id: i64, market_type: u8)]
pub struct CreateMarket<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 8 + 1 + 32 + 8 + 8 + 1 + 2 + 8 + 1,
        seeds = [b"market", fixture_id.to_le_bytes().as_ref(), &[market_type]],
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = authority,
        seeds = [b"vault", market.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = vault,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"usdc-mint"],
        bump,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        init_if_needed,
        payer = bettor,
        space = 8 + 8 + 1 + 1 + 1,
        seeds = [b"bet", market.key().as_ref(), bettor.key().as_ref()],
        bump
    )]
    pub bet: Account<'info, Bet>,

    #[account(
        mut,
        seeds = [b"usdc-mint"],
        bump,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = bettor_token_account.mint == mint.key()
    )]
    pub bettor_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub bettor: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    /// CHECK: Checked by key ownership dynamically in instruction
    pub daily_scores_merkle_roots: AccountInfo<'info>,

    /// CHECK: Address is verified against the canonical TxLINE devnet program ID.
    #[account(constraint = txline_program.key().to_string() == TXLINE_PROGRAM_ID @ GoalLineError::InvalidOracleOwner)]
    pub txline_program: AccountInfo<'info>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        close = bettor,
        seeds = [b"bet", market.key().as_ref(), bettor.key().as_ref()],
        bump = bet.bump
    )]
    pub bet: Account<'info, Bet>,

    #[account(
        mut,
        seeds = [b"usdc-mint"],
        bump,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = bettor_token_account.mint == mint.key()
    )]
    pub bettor_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub bettor: Signer<'info>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[account]
pub struct Market {
    pub fixture_id: i64,
    pub market_type: u8,
    pub authority: Pubkey,
    pub total_yes_amount: u64,
    pub total_no_amount: u64,
    pub is_settled: bool,
    pub winner: Option<bool>,
    pub closes_at: i64,
    pub bump: u8,
}

#[account]
pub struct Bet {
    pub amount: u64,
    pub prediction: bool,
    pub is_claimed: bool,
    pub bump: u8,
}

#[error_code]
pub enum GoalLineError {
    #[msg("This market is already closed for bets.")]
    MarketClosed,
    #[msg("This market has already been settled.")]
    MarketAlreadySettled,
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Math calculation overflowed.")]
    MathOverflow,
    #[msg("The validation data oracle returned an invalid owner.")]
    InvalidOracleOwner,
    #[msg("Oracle return data structure serialization failed.")]
    SerializationError,
    #[msg("No return data received from the oracle program.")]
    NoReturnData,
    #[msg("The return data length from the oracle program was invalid.")]
    InvalidReturnDataLength,
    #[msg("This market has not been settled yet.")]
    MarketNotSettled,
    #[msg("User has already claimed their winnings.")]
    WinningsAlreadyClaimed,
    #[msg("The user's bet prediction did not match the game outcome.")]
    BettorLost,
    #[msg("Cannot change prediction after placing a bet.")]
    CannotChangePrediction,
}
