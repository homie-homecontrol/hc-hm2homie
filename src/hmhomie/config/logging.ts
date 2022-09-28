import * as winston from "winston";

export const log = winston.child({
    type: 'hmhomiecfg',
});
