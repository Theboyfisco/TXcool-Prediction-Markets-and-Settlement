export const GOALLINE_IDL = {
  address: "7Ao2A14qmYxnERuFRcGhFqVgA1p55eKr5RLfjhR9gXm8",
  metadata: {
    name: "goalline_program",
    version: "0.1.0",
    spec: "0.1.0",
    description: "GoalLine trustless World Cup prediction market",
  },
  instructions: [
    {
      name: "initializeMint",
      discriminator: [209, 42, 195, 4, 129, 85, 209, 44],
      accounts: [
        { name: "mint", writable: true, pda: { seeds: [{ kind: "const", value: [117, 115, 100, 99, 45, 109, 105, 110, 116] }] } },
        { name: "authority", writable: true, signer: true },
        { name: "tokenProgram" },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
      ],
      args: [],
    },
    {
      name: "requestFaucet",
      discriminator: [241, 161, 37, 14, 117, 165, 218, 191],
      accounts: [
        { name: "mint", writable: true },
        { name: "userTokenAccount", writable: true },
        { name: "user", writable: true, signer: true },
        { name: "associatedTokenProgram" },
        { name: "tokenProgram" },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
      ],
      args: [],
    },
    {
      name: "createMarket",
      discriminator: [103, 226, 97, 235, 200, 188, 251, 254],
      accounts: [
        { name: "market", writable: true },
        { name: "vault", writable: true },
        { name: "mint" },
        { name: "authority", writable: true, signer: true },
        { name: "tokenProgram" },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
      ],
      args: [
        { name: "fixtureId", type: "i64" },
        { name: "marketType", type: "u8" },
        { name: "closesAt", type: "i64" },
      ],
    },
    {
      name: "placeBet",
      discriminator: [222, 62, 67, 220, 63, 166, 126, 33],
      accounts: [
        { name: "market", writable: true },
        { name: "bet", writable: true },
        { name: "mint", writable: true },
        { name: "bettorTokenAccount", writable: true },
        { name: "vault", writable: true },
        { name: "bettor", writable: true, signer: true },
        { name: "tokenProgram" },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
      ],
      args: [
        { name: "amount", type: "u64" },
        { name: "prediction", type: "bool" },
      ],
    },
    {
      name: "settleMarket",
      discriminator: [193, 153, 95, 216, 166, 6, 144, 217],
      accounts: [
        { name: "market", writable: true },
        { name: "dailyScoresMerkleRoots" },
        { name: "txlineProgram" },
        { name: "authority", signer: true },
      ],
      args: [
        { name: "ts", type: "i64" },
        { name: "fixtureSummary", type: { defined: { name: "ScoresBatchSummary" } } },
        { name: "fixtureProof", type: { vec: { defined: { name: "ProofNode" } } } },
        { name: "mainTreeProof", type: { vec: { defined: { name: "ProofNode" } } } },
        { name: "predicate", type: { defined: { name: "TraderPredicate" } } },
        { name: "statA", type: { defined: { name: "StatTerm" } } },
        { name: "statB", type: { option: { defined: { name: "StatTerm" } } } },
        { name: "op", type: { option: { defined: { name: "BinaryExpression" } } } },
      ],
    },
    {
      name: "claimWinnings",
      discriminator: [161, 215, 24, 59, 14, 236, 242, 221],
      accounts: [
        { name: "market", writable: true },
        { name: "bet", writable: true },
        { name: "mint", writable: true },
        { name: "bettorTokenAccount", writable: true },
        { name: "vault", writable: true },
        { name: "bettor", writable: true, signer: true },
        { name: "tokenProgram" },
      ],
      args: [],
    },
  ],
  accounts: [
    { name: "Market", discriminator: [219, 190, 213, 55, 0, 227, 198, 154] },
    { name: "Bet", discriminator: [147, 23, 35, 59, 15, 75, 155, 32] },
  ],
  types: [
    {
      name: "Market",
      type: {
        kind: "struct",
        fields: [
          { name: "fixtureId", type: "i64" },
          { name: "marketType", type: "u8" },
          { name: "authority", type: "pubkey" },
          { name: "totalYesAmount", type: "u64" },
          { name: "totalNoAmount", type: "u64" },
          { name: "isSettled", type: "bool" },
          { name: "winner", type: { option: "bool" } },
          { name: "closesAt", type: "i64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "Bet",
      type: {
        kind: "struct",
        fields: [
          { name: "amount", type: "u64" },
          { name: "prediction", type: "bool" },
          { name: "isClaimed", type: "bool" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "ScoresUpdateStats",
      type: {
        kind: "struct",
        fields: [
          { name: "updateCount", type: "i32" },
          { name: "minTimestamp", type: "i64" },
          { name: "maxTimestamp", type: "i64" },
        ],
      },
    },
    {
      name: "ScoresBatchSummary",
      type: {
        kind: "struct",
        fields: [
          { name: "fixtureId", type: "i64" },
          { name: "updateStats", type: { defined: { name: "ScoresUpdateStats" } } },
          { name: "eventsSubTreeRoot", type: { array: ["u8", 32] } },
        ],
      },
    },
    {
      name: "ProofNode",
      type: {
        kind: "struct",
        fields: [
          { name: "hash", type: { array: ["u8", 32] } },
          { name: "isRightSibling", type: "bool" },
        ],
      },
    },
    {
      name: "ScoreStat",
      type: {
        kind: "struct",
        fields: [
          { name: "key", type: "u32" },
          { name: "value", type: "i32" },
          { name: "period", type: "i32" },
        ],
      },
    },
    {
      name: "StatTerm",
      type: {
        kind: "struct",
        fields: [
          { name: "statToProve", type: { defined: { name: "ScoreStat" } } },
          { name: "eventStatRoot", type: { array: ["u8", 32] } },
          { name: "statProof", type: { vec: { defined: { name: "ProofNode" } } } },
        ],
      },
    },
    {
      name: "TraderPredicate",
      type: {
        kind: "struct",
        fields: [
          { name: "threshold", type: "i32" },
          { name: "comparison", type: { defined: { name: "Comparison" } } },
        ],
      },
    },
    {
      name: "Comparison",
      type: { kind: "enum", variants: [{ name: "GreaterThan" }, { name: "LessThan" }, { name: "EqualTo" }] },
    },
    {
      name: "BinaryExpression",
      type: { kind: "enum", variants: [{ name: "Add" }, { name: "Subtract" }] },
    },
  ],
  errors: [
    { code: 6000, name: "MarketClosed", msg: "This market is already closed for bets." },
    { code: 6001, name: "MarketAlreadySettled", msg: "This market has already been settled." },
    { code: 6002, name: "InvalidAmount", msg: "Amount must be greater than zero." },
    { code: 6003, name: "MathOverflow", msg: "Math calculation overflowed." },
    { code: 6004, name: "InvalidOracleOwner", msg: "The validation data oracle returned an invalid owner." },
    { code: 6005, name: "SerializationError", msg: "Oracle return data structure serialization failed." },
    { code: 6006, name: "NoReturnData", msg: "No return data received from the oracle program." },
    { code: 6007, name: "InvalidReturnDataLength", msg: "The return data length from the oracle program was invalid." },
    { code: 6008, name: "MarketNotSettled", msg: "This market has not been settled yet." },
    { code: 6009, name: "WinningsAlreadyClaimed", msg: "User has already claimed their winnings." },
    { code: 6010, name: "BettorLost", msg: "The user's bet prediction did not match the game outcome." },
  ],
} as const;
