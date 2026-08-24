declare namespace NodeJS { interface ErrnoException { code?: string; } }
declare module "node:crypto" { export function createHash(name: string): { update(value: string): { digest(encoding: string): string } }; }
declare module "node:fs/promises" { export function readFile(path: string, encoding: "utf8"): Promise<string>; export function readdir(path: string): Promise<string[]>; }
declare module "node:path" { export function join(...parts: string[]): string; }
