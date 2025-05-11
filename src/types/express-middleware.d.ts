/**
 * src/types/express-middleware.d.ts
 * Express middleware için özel tip tanımlamaları
 */
import { NextFunction, Request, Response } from 'express';

// Express middleware için özel tip tanımlamaları
declare module 'express' {
  // Express Application için özel tip tanımlamaları
  interface Application {
    // Application.get için özel tip tanımlaması
    get(path: string, handler: (req: Request, res: Response) => void | Response): this;
    get(
      path: string,
      middleware: (req: Request, res: Response, next: NextFunction) => void,
      handler: (req: Request, res: Response) => void | Response
    ): this;
    get(
      path: string,
      ...handlers: ((req: Request, res: Response, next: NextFunction) => void)[]
    ): this;

    // Application.post için özel tip tanımlaması
    post(
      path: string,
      handler: (req: Request, res: Response, next?: NextFunction) => void | Response
    ): this;
    post(
      path: string,
      middleware: (req: Request, res: Response, next: NextFunction) => void,
      handler: (req: Request, res: Response) => void | Response
    ): this;
    post(
      path: string,
      ...handlers: ((req: Request, res: Response, next: NextFunction) => void)[]
    ): this;

    // Application.put için özel tip tanımlaması
    put(
      path: string,
      handler: (req: Request, res: Response, next?: NextFunction) => void | Response
    ): this;

    // Application.delete için özel tip tanımlaması
    delete(
      path: string,
      handler: (req: Request, res: Response, next?: NextFunction) => void | Response
    ): this;

    // Application.patch için özel tip tanımlaması
    patch(
      path: string,
      handler: (req: Request, res: Response, next?: NextFunction) => void | Response
    ): this;
  }

  // Express Router için özel tip tanımlamaları
  interface IRouter {
    // Router.use için özel tip tanımlaması
    use(handler: (req: Request, res: Response, next: NextFunction) => void | Response): this;
    use(
      path: string,
      handler: (req: Request, res: Response, next: NextFunction) => void | Response
    ): this;
    use(
      path: string,
      ...handlers: ((req: Request, res: Response, next: NextFunction) => void)[]
    ): this;

    // Router.get için özel tip tanımlaması
    get(
      path: string,
      handler: (req: Request, res: Response, next?: NextFunction) => void | Response
    ): this;

    // Router.post için özel tip tanımlaması
    post(
      path: string,
      handler: (req: Request, res: Response, next?: NextFunction) => void | Response
    ): this;
    post(
      path: string,
      middleware: (req: Request, res: Response, next: NextFunction) => void,
      handler: (req: Request, res: Response) => void | Response
    ): this;
    post(
      path: string,
      ...handlers: ((req: Request, res: Response, next: NextFunction) => void)[]
    ): this;

    // Router.put için özel tip tanımlaması
    put(
      path: string,
      handler: (req: Request, res: Response, next?: NextFunction) => void | Response
    ): this;

    // Router.delete için özel tip tanımlaması
    delete(
      path: string,
      handler: (req: Request, res: Response, next?: NextFunction) => void | Response
    ): this;

    // Router.patch için özel tip tanımlaması
    patch(
      path: string,
      handler: (req: Request, res: Response, next?: NextFunction) => void | Response
    ): this;
  }
}
