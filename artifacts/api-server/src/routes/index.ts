import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import eventsRouter from "./events";
import betsRouter from "./bets";
import walletRouter from "./wallet";
import adminRouter from "./admin";
import dashboardRouter from "./dashboard";
import gamesRouter from "./games";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(eventsRouter);
router.use(betsRouter);
router.use(walletRouter);
router.use(adminRouter);
router.use(dashboardRouter);
router.use(gamesRouter);

export default router;
