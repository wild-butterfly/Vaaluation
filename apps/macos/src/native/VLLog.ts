import { NativeModules } from 'react-native';
import type { LogEntry, LogLevel } from '@vaaluation/shared-types';

interface VLLogNative {
  log(level: LogLevel, scope: string, message: string): void;
  getRecent(limit: number): Promise<LogEntry[]>;
  clear(): Promise<void>;
  getLogFilePath(): Promise<string>;
}

const native = NativeModules.VLLog as VLLogNative;

export function log(level: LogLevel, scope: string, message: string): void {
  native.log(level, scope, message);
}

export function getRecentLogs(limit = 200): Promise<LogEntry[]> {
  return native.getRecent(limit);
}

export function clearLogs(): Promise<void> {
  return native.clear();
}

export function getLogFilePath(): Promise<string> {
  return native.getLogFilePath();
}
