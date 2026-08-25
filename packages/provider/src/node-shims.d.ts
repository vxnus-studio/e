declare module "node:crypto" {
  export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
}
