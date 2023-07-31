import { HomeAssistant } from "../types";
import { Upload } from "../util/upload";

interface Image {
  filesize: number;
  name: string;
  uploaded_at: string; // isoformat date
  content_type: string;
  id: string;
}

export interface ImageMutableParams {
  name: string;
}

export const generateImageThumbnailUrl = (mediaId: string, size: number) =>
  `/api/image/serve/${mediaId}/${size}x${size}`;

export const fetchImages = (hass: HomeAssistant) =>
  hass.callWS<Image[]>({ type: "image/list" });

export const createImageUpload = async (
  hass: HomeAssistant,
  file: File
): Promise<Upload> => {
  const fd = new FormData();
  fd.append("file", file);
  return hass.uploadWithAuth("/api/image/upload", fd);
};

export const doImageUpload = async (upload: Upload): Promise<Image> => {
  const resp = await upload.upload();
  if (resp.status === 413) {
    throw new Error("Uploaded image is too large");
  } else if (resp.status !== 200) {
    throw new Error("Unknown error");
  }
  return resp.json();
};

export const updateImage = (
  hass: HomeAssistant,
  id: string,
  updates: Partial<ImageMutableParams>
) =>
  hass.callWS<Image>({
    type: "image/update",
    media_id: id,
    ...updates,
  });

export const deleteImage = (hass: HomeAssistant, id: string) =>
  hass.callWS({
    type: "image/delete",
    media_id: id,
  });
