import {Request, Response, NextFunction} from "express";

const discordLastCheckTime: number | null = null;

/**
 * @description 10분 간격 디스코드 연결 확인
 */
export async function discordConnCache(req: Request, res: Response, next: NextFunction) {}
