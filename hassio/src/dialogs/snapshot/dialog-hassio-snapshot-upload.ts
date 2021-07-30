import { mdiClose, mdiArchiveArrowUp } from "@mdi/js";
import { css, CSSResultGroup, html, LitElement, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators";
import { fireEvent } from "../../../../src/common/dom/fire_event";
import "../../../../src/components/ha-header-bar";
import { HassDialog } from "../../../../src/dialogs/make-dialog-manager";
import { haStyleDialog } from "../../../../src/resources/styles";
import type { HomeAssistant } from "../../../../src/types";
import "../../../../src/components/ha-file-upload";
import { HassioSnapshotUploadDialogParams } from "./show-dialog-snapshot-upload";
import { showAlertDialog } from "../../../../src/dialogs/generic/show-dialog-box";
import {
  createSnapshotUpload,
} from "../../../../src/data/hassio/snapshot";
import { extractApiErrorMessage } from "../../../../src/data/hassio/common";
import { Upload } from "../../../../src/util/upload";

@customElement("dialog-hassio-snapshot-upload")
export class DialogHassioSnapshotUpload
  extends LitElement
  implements HassDialog<HassioSnapshotUploadDialogParams>
{
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _params?: HassioSnapshotUploadDialogParams;

  @state() private _upload?: Upload;

  public async showDialog(
    params: HassioSnapshotUploadDialogParams
  ): Promise<void> {
    this._params = params;
    await this.updateComplete;
  }

  public closeDialog(): void {
    if (this._params && !this._params.onboarding) {
      if (this._params.reloadSnapshot) {
        this._params.reloadSnapshot();
      }
    }
    this._params = undefined;
    fireEvent(this, "dialog-closed", { dialog: this.localName });
  }

  protected render(): TemplateResult {
    if (!this._params) {
      return html``;
    }

    return html`
      <ha-dialog
        open
        scrimClickAction
        escapeKeyAction
        hideActions
        .heading=${true}
        @closed=${this._cancelAndClose}
      >
        <div slot="heading">
          <ha-header-bar>
            <span slot="title"> Upload snapshot </span>
            <mwc-icon-button slot="actionItems" dialogAction="cancel">
              <ha-svg-icon .path=${mdiClose}></ha-svg-icon>
            </mwc-icon-button>
          </ha-header-bar>
        </div>
        <ha-file-upload
          .upload=${this._upload}
          .icon=${mdiArchiveArrowUp}
          accept="application/x-tar"
          label="Upload snapshot"
          @file-picked=${this._uploadFile}
          @cancel-upload=${this._cancel}
          auto-open-file-dialog
        ></ha-file-upload>
      </ha-dialog>
    `;
  }

  private _snapshotUploaded(snapshot) {
    this._params?.showSnapshot(snapshot.slug);
    this.closeDialog();
  }

  private _cancel() {
    if (this._upload) {
      this._upload.abort();
    }
  }

  private _cancelAndClose() {
    this._cancel();
    this.closeDialog();
  }

  private async _uploadFile(ev) {
    const file = ev.detail.files[0];
    if (!["application/x-tar"].includes(file.type)) {
      showAlertDialog(this, {
        title: "Unsupported file format",
        text: "Please choose a Home Assistant snapshot file (.tar)",
        confirmText: "ok",
      });
      return;
    }
    try {
      this._upload = await createSnapshotUpload(this.hass, file);
      const resp = await this._upload.upload();
      if (resp.status === 200) {
        const snapshot = (await resp.json()).data;

        // Querying for a snaphot immediately after upload can return
        // "Snapshot not found" with large snapshots, so give it few seconds.
        await new Promise((resolve) => setTimeout(resolve, 2000));
        this._snapshotUploaded(snapshot);
      } else {
        let message = "";
        if (resp.status === 400) {
          // HTTP 400/Bad Request means the supervisor couldn't parse the snapshot.
          message = "Please make sure this is a valid snapshot file.";
        } else if (resp.status === 413) {
          message = "The snapshot is too large.";
        } else {
          // Error responses from the supervisor always include an error message
          message = extractApiErrorMessage(await resp.json());
        }
        showAlertDialog(this, {
          title: "Upload failed",
          text: message,
          confirmText: "ok",
        });
      }
    } catch (err) {
      if (err.message !== "abort") {
        // A network error caused the upload to fail, for example if the
        // connection was reset, so just report the error.
        showAlertDialog(this, {
          title: "Upload failed",
          text: "",
          confirmText: "ok",
        });
      }
    } finally {
      this._upload = undefined;
    }
  }

  static get styles(): CSSResultGroup {
    return [
      haStyleDialog,
      css`
        ha-header-bar {
          --mdc-theme-on-primary: var(--primary-text-color);
          --mdc-theme-primary: var(--mdc-theme-surface);
          flex-shrink: 0;
        }
        /* overrule the ha-style-dialog max-height on small screens */
        @media all and (max-width: 450px), all and (max-height: 500px) {
          ha-header-bar {
            --mdc-theme-primary: var(--app-header-background-color);
            --mdc-theme-on-primary: var(--app-header-text-color, white);
          }
        }
      `,
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "dialog-hassio-snapshot-upload": DialogHassioSnapshotUpload;
  }
}
