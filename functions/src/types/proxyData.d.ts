export interface ProxyData {
  ipAddress: string;
  port: number | null;
  type: string | null;
  latency: number;
  lastCheckStatus: string | null;
}

export interface ProxyDoc extends ProxyData {
  available: boolean;
  used: boolean;
}