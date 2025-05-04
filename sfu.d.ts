/**
 * createWorkers() => uygulama başlarken çağrılacak.
 */
export function createWorkers(): Promise<void>;
/**
 * createRouter(roomId)
 */
export function createRouter(roomId: any): Promise<any>;
/**
 * getRouter(roomId) => varsa döndür.
 */
export function getRouter(roomId: any): any;
/**
 * createWebRtcTransport
 *
 * Burada TURN sunucunuzu ekliyoruz => "iceServers"
 * Değerler .env içindeki ANNOUNCED_IP, TURN_USERNAME, TURN_CREDENTIAL değişkenlerinden okunuyor.
 */
export function createWebRtcTransport(router: any): Promise<any>;
/**
 * connectTransport
 */
export function connectTransport(transport: any, dtlsParameters: any): Promise<void>;
/**
 * produce => transport üzerinde Producer yaratır
 */
export function produce(transport: any, kind: any, rtpParameters: any): Promise<any>;
/**
 * consume => Artık router.producers.get(producerId) yerine direkt producer nesnesi alacağız.
 */
export function consume(router: any, transport: any, producer: any): Promise<any>;
/**
 * Kapatma yardımcıları
 */
export function closeTransport(transport: any): Promise<void>;
export function closeProducer(producer: any): Promise<void>;
export function closeConsumer(consumer: any): Promise<void>;
