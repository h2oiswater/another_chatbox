import type { LogEntry } from '../types';

class LogManager {
  private logs: LogEntry[] = [];
  private subscribers: ((logs: LogEntry[]) => void)[] = [];

  log(level: 'INFO' | 'ERROR' | 'REQUEST' | 'RESPONSE', message: string) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      message: message
    };
    this.logs.push(entry);
    console.log(`[${entry.level}] ${message}`);
    this.notify();
  }

  clear() {
    this.logs = [];
    this.notify();
  }

  subscribe(callback: (logs: LogEntry[]) => void) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  private notify() {
    this.subscribers.forEach(sub => sub(this.logs));
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  getFormattedLogs(): string {
    return this.logs.map(entry => {
      const date = new Date(entry.timestamp);
      const timeStr = date.toTimeString().split(' ')[0] + '.' + String(date.getMilliseconds()).padStart(3, '0');
      return `[${timeStr}] [${entry.level}] ${entry.message}`;
    }).join('\n');
  }
}

export const logger = new LogManager();
