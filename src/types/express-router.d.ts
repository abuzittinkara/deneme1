/**
 * src/types/express-router.d.ts
 * Express Router için özel tip tanımlamaları
 */
import { NextFunction, Request, Response, Router } from 'express';

// Express Router için özel tip tanımlamaları
declare module 'express' {
  interface Router {
    // Router.use için özel tip tanımlaması
    use(handler: (req: Request, res: Response, next: NextFunction) => void | Response): Router;
    
    // Router.get için özel tip tanımlaması
    get(path: string, handler: (req: Request, res: Response, next?: NextFunction) => void | Response): Router;
    
    // Router.post için özel tip tanımlaması
    post(path: string, handler: (req: Request, res: Response, next?: NextFunction) => void | Response): Router;
    
    // Router.put için özel tip tanımlaması
    put(path: string, handler: (req: Request, res: Response, next?: NextFunction) => void | Response): Router;
    
    // Router.delete için özel tip tanımlaması
    delete(path: string, handler: (req: Request, res: Response, next?: NextFunction) => void | Response): Router;
    
    // Router.patch için özel tip tanımlaması
    patch(path: string, handler: (req: Request, res: Response, next?: NextFunction) => void | Response): Router;
  }
}
