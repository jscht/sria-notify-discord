export type ServiceName = "recruit";

export type KeyManager<T extends Record<string, any>> = {
  [K in ServiceName]: InstanceType<T[K]>;
};
