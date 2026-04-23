import { Router, type IRouter } from "express";
import { db, usersTable, transactionsTable, withdrawalRequestsTable, depositRequestsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { GetTransactionsQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/wallet/balance", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const balance = parseFloat(user.balance);
  const bonusBalance = parseFloat(user.bonusBalance);
  const withdrawable = Math.max(0, balance - bonusBalance);

  res.json({
    balance,
    bonusBalance,
    withdrawableBalance: withdrawable,
    totalDeposited: parseFloat(user.totalDeposited),
    totalWagered: parseFloat(user.totalWagered),
    totalWon: parseFloat(user.totalWon),
  });
});

router.post("/wallet/deposit", requireAuth, async (req, res): Promise<void> => {
  const { amount, paymentMethod, transactionRef } = req.body;
  const validMethods = ["easypaisa", "jazzcash", "bank_transfer"];

  if (!amount || isNaN(Number(amount)) || Number(amount) < 100 || Number(amount) > 1000000) {
    res.status(400).json({ error: "Invalid amount. Minimum deposit is PKR 100." });
    return;
  }
  if (!validMethods.includes(paymentMethod)) {
    res.status(400).json({ error: "Invalid payment method." });
    return;
  }
  if (!transactionRef || String(transactionRef).length < 3) {
    res.status(400).json({ error: "Please provide a valid transaction reference or description." });
    return;
  }

  const parsedAmount = Number(amount);
  const userId = req.session.userId!;

  const pending = await db
    .select()
    .from(depositRequestsTable)
    .where(eq(depositRequestsTable.userId, userId));

  const hasPending = pending.some((r) => r.status === "pending");
  if (hasPending) {
    res.status(400).json({ error: "You already have a pending deposit request. Please wait for it to be approved." });
    return;
  }

  await db.insert(depositRequestsTable).values({
    userId,
    amount: String(parsedAmount),
    paymentMethod,
    transactionRef: String(transactionRef),
    status: "pending",
  });

  res.json({ message: "Deposit request submitted. The admin will review and credit your account shortly." });
});

router.get("/wallet/deposit-requests", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const requests = await db
    .select()
    .from(depositRequestsTable)
    .where(eq(depositRequestsTable.userId, userId))
    .orderBy(sql`${depositRequestsTable.createdAt} desc`);

  res.json(
    requests.map((r) => ({
      id: r.id,
      amount: parseFloat(r.amount),
      paymentMethod: r.paymentMethod,
      transactionRef: r.transactionRef,
      status: r.status,
      adminNote: r.adminNote,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.get("/wallet/transactions", requireAuth, async (req, res): Promise<void> => {
  const params = GetTransactionsQueryParams.safeParse(req.query);
  const limit = params.success ? (params.data.limit ?? 20) : 20;
  const userId = req.session.userId!;

  const txns = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(sql`${transactionsTable.createdAt} desc`)
    .limit(limit);

  res.json(
    txns.map((t) => ({
      id: t.id,
      type: t.type,
      amount: parseFloat(t.amount),
      balanceAfter: parseFloat(t.balanceAfter),
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),
  );
});

router.post("/wallet/withdraw-request", requireAuth, async (req, res): Promise<void> => {
  const { amount, paymentMethod, accountDetails } = req.body;
  const validMethods = ["easypaisa", "jazzcash", "bank_transfer"];
  if (!amount || isNaN(Number(amount)) || Number(amount) < 500 || Number(amount) > 500000) {
    res.status(400).json({ error: "Invalid amount. Minimum withdrawal is PKR 500." });
    return;
  }
  if (!validMethods.includes(paymentMethod)) {
    res.status(400).json({ error: "Invalid payment method." });
    return;
  }
  if (!accountDetails || String(accountDetails).length < 5) {
    res.status(400).json({ error: "Please provide valid account details." });
    return;
  }

  const parsedAmount = Number(amount);
  const userId = req.session.userId!;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const currentBalance = parseFloat(user.balance);
  const bonusAmt = parseFloat(user.bonusBalance);
  const withdrawable = Math.max(0, currentBalance - bonusAmt);

  if (parsedAmount > withdrawable) {
    if (withdrawable <= 0) {
      res.status(400).json({ error: "You have no withdrawable balance. Your current funds consist entirely of bonus credit — play games to earn real withdrawable winnings." });
    } else {
      res.status(400).json({ error: `You can only withdraw up to PKR ${withdrawable.toLocaleString()} (your balance minus non-withdrawable bonus of PKR ${bonusAmt.toLocaleString()}).` });
    }
    return;
  }

  const pending = await db
    .select()
    .from(withdrawalRequestsTable)
    .where(eq(withdrawalRequestsTable.userId, userId));

  const hasPending = pending.some((r) => r.status === "pending");
  if (hasPending) {
    res.status(400).json({ error: "You already have a pending withdrawal request. Please wait for it to be processed." });
    return;
  }

  await db.insert(withdrawalRequestsTable).values({
    userId,
    amount: String(parsedAmount),
    paymentMethod,
    accountDetails: String(accountDetails),
    status: "pending",
  });

  res.json({ message: "Withdrawal request submitted. The admin will process it shortly." });
});

router.get("/wallet/withdraw-requests", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const requests = await db
    .select()
    .from(withdrawalRequestsTable)
    .where(eq(withdrawalRequestsTable.userId, userId))
    .orderBy(sql`${withdrawalRequestsTable.createdAt} desc`);

  res.json(
    requests.map((r) => ({
      id: r.id,
      amount: parseFloat(r.amount),
      paymentMethod: r.paymentMethod,
      accountDetails: r.accountDetails,
      status: r.status,
      adminNote: r.adminNote,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

export default router;
