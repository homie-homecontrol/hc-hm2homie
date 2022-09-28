import { CCUDevWeekdays } from "../../ccu";

export type TimeDef = { endtime: number, temp: number }

export type DayProgram = [TimeDef,TimeDef,TimeDef,TimeDef,TimeDef,TimeDef,TimeDef,TimeDef,TimeDef,TimeDef,TimeDef,TimeDef,TimeDef];

export type WeekProgram = {
    [weekday in CCUDevWeekdays]: DayProgram
}

export type WeekPrograms = WeekProgram[];
