import { CCUDevWeekdays } from "../../ccu";

export type TimeDef = { endtime: number, temp: number }

export type DayProgram = [TimeDef,TimeDef,TimeDef,TimeDef,TimeDef,TimeDef,TimeDef,TimeDef,TimeDef,TimeDef,TimeDef,TimeDef,TimeDef];

export type WeekProgram = {
    [weekday in CCUDevWeekdays]: DayProgram
}

export type WeekPrograms = WeekProgram[];

export const boostTimeValues = [
    "0m",
    "5m",
    "10m",
    "15m",
    "20m",
    "25m",
    "30m"] as const;

export type BoostTimeValue = typeof boostTimeValues[number];