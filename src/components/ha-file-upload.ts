import "@material/mwc-button/mwc-button";
import "@material/mwc-icon-button/mwc-icon-button";
import { mdiClose, mdiCancel } from "@mdi/js";
import "@polymer/iron-input/iron-input";
import "@polymer/paper-input/paper-input-container";
import { css, html, LitElement, PropertyValues, TemplateResult } from "lit";
import { customElement, property, state, query } from "lit/decorators";
import { classMap } from "lit/directives/class-map";
import { fireEvent } from "../common/dom/fire_event";
import "@material/mwc-linear-progress";
import "./ha-svg-icon";
import { bytesToString } from "../util/bytes-to-string";
import { Upload } from "../util/upload";

declare global {
  interface HASSDomEvents {
    "file-picked": { files: FileList };
    "cancel-upload": Record<string, never>;
  }
}

@customElement("ha-file-upload")
export class HaFileUpload extends LitElement {
  @property() public accept!: string;

  @property() public icon!: string;

  @property() public label!: string;

  @property() public value: string | TemplateResult | null = null;

  private _upload?: Upload;

  set upload(val: Upload | undefined) {
    this._bindToUpload(val);
  }

  @property({ attribute: false })
  get upload() {
    return this._upload;
  }

  @state() private indeterminate = false;

  @state() private progress = 0;

  @state() private totalBytes = 0;

  @state() private progressBytes = 0;

  @property({ type: Boolean, attribute: "auto-open-file-dialog" })
  private autoOpenFileDialog = false;

  @state() private _drag = false;

  @query("#input") private _input?: HTMLInputElement;

  protected firstUpdated(changedProperties: PropertyValues) {
    super.firstUpdated(changedProperties);
    if (this.autoOpenFileDialog) {
      this._openFileDialog();
    }
  }

  protected updated(changedProperties: PropertyValues) {
    if (changedProperties.has("_drag") && !this._upload) {
      (
        this.shadowRoot!.querySelector("paper-input-container") as any
      )._setFocused(this._drag);
    }
  }

  public render(): TemplateResult {
    return html`
      ${this._upload
        ? html` <div class="flex-container">
              <mwc-linear-progress
                class="progress-bar spaced"
                progress=${this.progress}
                ?indeterminate=${this.indeterminate}
              ></mwc-linear-progress>
              <span class="spaced">${Math.floor(this.progress * 100)}%</span>
              <mwc-icon-button class="spaced" @click=${this._cancelUpload}>
                <ha-svg-icon
                  class="warning-svg"
                  .path=${mdiCancel}
                ></ha-svg-icon>
              </mwc-icon-button>
            </div>
            <div>
              ${bytesToString(this.progressBytes)} /
              ${bytesToString(this.totalBytes)}
            </div>`
        : html`
            <label for="input">
              <paper-input-container
                .alwaysFloatLabel=${Boolean(this.value)}
                @drop=${this._handleDrop}
                @dragenter=${this._handleDragStart}
                @dragover=${this._handleDragStart}
                @dragleave=${this._handleDragEnd}
                @dragend=${this._handleDragEnd}
                class=${classMap({
                  dragged: this._drag,
                })}
              >
                <label for="input" slot="label"> ${this.label} </label>
                <iron-input slot="input">
                  <input
                    id="input"
                    type="file"
                    class="file"
                    accept=${this.accept}
                    @change=${this._handleFilePicked}
                  />
                  ${this.value}
                </iron-input>
                ${this.value
                  ? html`<mwc-icon-button
                      slot="suffix"
                      @click=${this._clearValue}
                    >
                      <ha-svg-icon .path=${mdiClose}></ha-svg-icon>
                    </mwc-icon-button>`
                  : html`<mwc-icon-button
                      slot="suffix"
                      @click=${this._openFileDialog}
                    >
                      <ha-svg-icon .path=${this.icon}></ha-svg-icon>
                    </mwc-icon-button>`}
              </paper-input-container>
            </label>
          `}
    `;
  }

  private _bindToUpload(val?: Upload) {
    const oldValue = this._upload;
    if (val != null) {
      val.setListener((uploaded, total) => {
        this.progress = uploaded / total;
        this.progressBytes = uploaded;
        this.totalBytes = total;
        if (this.progress === 1 || this.progress === 0) {
          // Display the progress bar as "indeterminate" while any
          // post-processing happens after the upload or before any
          // bytes get sent.
          this.indeterminate = true;
        }
      });
    }
    this._upload = val;
    this.requestUpdate("upload", oldValue);
  }

  private _openFileDialog() {
    this._input?.click();
  }

  private _handleDrop(ev: DragEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.dataTransfer?.files) {
      fireEvent(this, "file-picked", { files: ev.dataTransfer.files });
    }
    this._drag = false;
  }

  private _handleDragStart(ev: DragEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    this._drag = true;
  }

  private _handleDragEnd(ev: DragEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    this._drag = false;
  }

  private _handleFilePicked(ev) {
    fireEvent(this, "file-picked", { files: ev.target.files });
  }

  private _clearValue(ev: Event) {
    ev.preventDefault();
    this.value = null;
    fireEvent(this, "change");
  }

  private _cancelUpload(_ev: Event) {
    fireEvent(this, "cancel-upload", {});
    this.upload = undefined;
    this.progress = 0;
  }

  static get styles() {
    return css`
      paper-input-container {
        position: relative;
        padding: 8px;
        margin: 0 -8px;
      }
      paper-input-container.dragged:before {
        position: var(--layout-fit_-_position);
        top: var(--layout-fit_-_top);
        right: var(--layout-fit_-_right);
        bottom: var(--layout-fit_-_bottom);
        left: var(--layout-fit_-_left);
        background: currentColor;
        content: "";
        opacity: var(--dark-divider-opacity);
        pointer-events: none;
        border-radius: 4px;
      }
      input.file {
        display: none;
      }
      img {
        max-width: 125px;
        max-height: 125px;
      }
      mwc-icon-button {
        --mdc-icon-button-size: 24px;
        --mdc-icon-size: 20px;
      }
      .flex-container {
        display: flex;
        margin-top: 10px;
        margin-bottom: 10px;
      }
      .progress-bar {
        padding-top: 10px;
        width: 100%;
      }
      .spaced {
        padding-left: 4px;
        padding-right: 4px;
      }
      .warning-svg {
        fill: var(--error-color);
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-file-upload": HaFileUpload;
  }
}
