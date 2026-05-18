import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import familiesRouter from "./families";
import membersRouter from "./members";
import postsRouter from "./posts";
import commentsRouter from "./comments";
import mediaRouter from "./media";
import notificationsRouter from "./notifications";
import eventsRouter from "./events";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(familiesRouter);
router.use(membersRouter);
router.use(postsRouter);
router.use(commentsRouter);
router.use(mediaRouter);
router.use(notificationsRouter);
router.use(eventsRouter);
router.use(adminRouter);

export default router;
