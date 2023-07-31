import "@material/mwc-icon-button/mwc-icon-button";
import { mdiImagePlus } from "@mdi/js";
import "@polymer/paper-input/paper-input-container";
import { html, LitElement, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators";
import { fireEvent } from "../common/dom/fire_event";
import {
  createImageUpload,
  doImageUpload,
  generateImageThumbnailUrl,
} from "../data/image";
import { showAlertDialog } from "../dialogs/generic/show-dialog-box";
import {
  CropOptions,
  showImageCropperDialog,
} from "../dialogs/image-cropper-dialog/show-image-cropper-dialog";
import { HomeAssistant } from "../types";
import "./ha-circular-progress";
import "./ha-file-upload";
import "./ha-svg-icon";
import { Upload } from "../util/upload";

@customElement("ha-picture-upload")
export class HaPictureUpload extends LitElement {
  public hass!: HomeAssistant;

  @property() public value: string | null = null;

  @property() public label?: string;

  @property({ type: Boolean }) public crop = false;

  @property({ attribute: false }) public cropOptions?: CropOptions;

  @property({ type: Number }) public size = 512;

  @state() private _upload: Upload | undefined = undefined;

  public render(): TemplateResult {
    return html`
      <ha-file-upload
        .icon=${mdiImagePlus}
        .label=${this.label ||
        this.hass.localize("ui.components.picture-upload.label")}
        .upload=${this._upload}
        .value=${this.value ? html`<img .src=${this.value} />` : ""}
        @file-picked=${this._handleFilePicked}
        @cancel-upload=${this._cancelUpload}
        accept="image/png, image/jpeg, image/gif"
      ></ha-file-upload>
    `;
  }

  private async _handleFilePicked(ev) {
    const file = ev.detail.files[0];
    if (this.crop) {
      this._cropFile(file);
    } else {
      this._uploadFile(file);
    }
  }

  private async _cropFile(file: File) {
    if (!["image/png", "image/jpeg", "image/gif"].includes(file.type)) {
      showAlertDialog(this, {
        text: this.hass.localize(
          "ui.components.picture-upload.unsupported_format"
        ),
      });
      return;
    }
    showImageCropperDialog(this, {
      file,
      options: this.cropOptions || {
        round: false,
        aspectRatio: NaN,
      },
      croppedCallback: (croppedFile) => {
        this._uploadFile(croppedFile);
      },
    });
  }

  private async _uploadFile(file: File) {
    if (!["image/png", "image/jpeg", "image/gif"].includes(file.type)) {
      showAlertDialog(this, {
        text: this.hass.localize(
          "ui.components.picture-upload.unsupported_format"
        ),
      });
      return;
    }
    try {
      this._upload = await createImageUpload(this.hass, file);
      const media = await doImageUpload(this._upload);
      this.value = generateImageThumbnailUrl(media.id, this.size);
      fireEvent(this, "change");
    } catch (err) {
      if (err instanceof Error && err.message === "abort") {
        // User cancelled the upload.
        return;
      }
      showAlertDialog(this, {
        text: err.toString(),
      });
    } finally {
      this._upload = undefined;
    }
  }

  private _cancelUpload() {
    if (this._upload) {
      this._upload.abort();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-picture-upload": HaPictureUpload;
  }
}
