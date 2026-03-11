type ToastType = "success" | "error" | "info" | "warning";

interface ToastEvent {
  type: ToastType;
  message: string;
}

type ToastCallback = (event: ToastEvent) => void;

class ToastEmitter {
  private listeners: ToastCallback[] = [];

  subscribe(callback: ToastCallback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private emit(type: ToastType, message: string) {
    this.listeners.forEach((l) => l({ type, message }));
  }

  success(msg: string) { this.emit("success", msg); }
  error(msg: string) { this.emit("error", msg); }
  info(msg: string) { this.emit("info", msg); }
  warning(msg: string) { this.emit("warning", msg); }
}

export const toast = new ToastEmitter();