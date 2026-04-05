//------------------------------------------------------------------------------
// MaRS iFrame Results Saver
//------------------------------------------------------------------------------
import {
  registerEditor,
  registerSimple,
  component,
  ScreenComponent,
  ScreenComponentFactory,
  Binding,
} from "@gorilla/compiled/task-builder.js";

//------------------------------------------------------------------------------
export interface MarsIframeResultsSaverFactory extends ScreenComponentFactory {
  allowedOrigin: string;
  mainObjectDestination: string;
  doneDestination: string;
  thetaDestination: string;
  semDestination: string;
  reliabilityDestination: string;
  itemCountDestination: string;
  fullDestination: string;
}

type MARSResultsPayload = any;
type MARSMessage = any;

//------------------------------------------------------------------------------
@component("task.component.MarsIframeResultsSaver")
export class MarsIframeResultsSaver extends ScreenComponent<MarsIframeResultsSaverFactory> {
  public construct() {
    this.mainObjectBinding = this.createBinding();
    this.doneBinding = this.createBinding();
    this.thetaBinding = this.createBinding();
    this.semBinding = this.createBinding();
    this.reliabilityBinding = this.createBinding();
    this.itemCountBinding = this.createBinding();
    this.fullBinding = this.createBinding();
    super.construct();
  }

  public apply(f: MarsIframeResultsSaverFactory) {
    this.allowedOrigin = (f.allowedOrigin || "").trim();

    this.mainObjectBinding.parseIfExists(f.mainObjectDestination);
    this.doneBinding.parseIfExists(f.doneDestination);
    this.thetaBinding.parseIfExists(f.thetaDestination);
    this.semBinding.parseIfExists(f.semDestination);
    this.reliabilityBinding.parseIfExists(f.reliabilityDestination);
    this.itemCountBinding.parseIfExists(f.itemCountDestination);
    this.fullBinding.parseIfExists(f.fullDestination);

    super.apply(f);
  }

  public screenStart() {
    super.screenStart();

    this.completed = false;
    this.messageHandler = (event: any) => {
      this.handleMessage(event);
    };

    window.addEventListener("message", this.messageHandler, false);
  }

  public screenFinish() {
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler, false);
      this.messageHandler = null;
    }

    super.screenFinish();
  }

  private handleMessage(event: any) {
    if (this.completed) {
      return;
    }

    if (!this.isAllowedOrigin(event.origin)) {
      return;
    }

    const msg = event.data as MARSMessage | null;
    if (!msg || msg.type !== "MARS_RESULTS") {
      return;
    }

    if (!this.isValidPayload(msg.data)) {
      return;
    }

    this.savePayload(msg.data);
    this.completed = true;
    this.finishAfterReceive();
  }

  private isAllowedOrigin(origin: string): boolean {
    if (!this.allowedOrigin) {
      return true;
    }

    return origin === this.allowedOrigin;
  }

  private isValidPayload(value: any): boolean {
    if (!value || typeof value !== "object") {
      return false;
    }

    const payload = value;
    return (
      typeof payload.theta === "number" &&
      typeof payload.sem === "number" &&
      typeof payload.reliability === "number" &&
      typeof payload.itemCount === "number" &&
      Array.isArray(payload.responses) &&
      typeof payload.sessionStartMs === "number" &&
      typeof payload.sessionEndMs === "number"
    );
  }

  private savePayload(payload: MARSResultsPayload): void {
    const json = JSON.stringify(payload);

    this.writeIfBound(this.mainObjectBinding, json);
    this.writeIfBound(this.fullBinding, json);
    this.writeIfBound(this.doneBinding, 1);
    this.writeIfBound(this.thetaBinding, payload.theta);
    this.writeIfBound(this.semBinding, payload.sem);
    this.writeIfBound(this.reliabilityBinding, payload.reliability);
    this.writeIfBound(this.itemCountBinding, payload.itemCount);
  }

  private writeIfBound(binding: Binding, value: string | number): void {
    try {
      binding.write(value);
    } catch (e) {
      // Ignore missing/unbound destinations.
    }
  }

  private finishAfterReceive(): void {
    const component = this as any;

    try {
      if (typeof component.triggerResponse === "function") {
        component.triggerResponse({
          responseType: 2,
          response: "mars_results_received",
          tag: "mars_complete",
          key: "mars_complete",
        });
        return;
      }
    } catch (e) {
      // Ignore errors when runtime doesn't expose triggerResponse.
    }
  }

  private allowedOrigin = "https://jakub-jedrusiak.github.io";
  private completed = false;
  private messageHandler: ((event: any) => void) | null = null;

  private mainObjectBinding: Binding;
  private doneBinding: Binding;
  private thetaBinding: Binding;
  private semBinding: Binding;
  private reliabilityBinding: Binding;
  private itemCountBinding: Binding;
  private fullBinding: Binding;
}

//------------------------------------------------------------------------------
registerEditor("MarsIframeResultsSaver", {
  label: "MaRS iFrame Saver",
  icon: "fas fa-database",
  form: {
    elements: [
      {
        class: "FormElementBindableText",
        field: "allowedOrigin",
        label: "Allowed postMessage origin (optional)",
      },
      {
        class: "FormElementBindableField",
        field: "mainObjectDestination",
        label: "Main object destination (e.g. marsMainObject)",
      },
      {
        class: "FormElementBindableField",
        field: "doneDestination",
        label: "Done destination (e.g. marsDone)",
      },
      {
        class: "FormElementBindableField",
        field: "thetaDestination",
        label: "Theta destination (e.g. marsData_theta)",
      },
      {
        class: "FormElementBindableField",
        field: "semDestination",
        label: "SEM destination (e.g. marsData_sem)",
      },
      {
        class: "FormElementBindableField",
        field: "reliabilityDestination",
        label: "Reliability destination (e.g. marsData_reliability)",
      },
      {
        class: "FormElementBindableField",
        field: "itemCountDestination",
        label: "Item count destination (e.g. marsData_itemCount)",
      },
      {
        class: "FormElementBindableField",
        field: "fullDestination",
        label: "Full JSON destination (e.g. marsFullResults)",
      },
    ],
  },
});

//------------------------------------------------------------------------------
registerSimple("screenComponent", "MarsIframeResultsSaver", {
  description:
    "Listens for MARS_RESULTS postMessage from an iFrame and saves payload values to bound Store fields.",
  category: "responseHandling",
});
//------------------------------------------------------------------------------
