export type ProgressEventListener = (
  this: Upload,
  sent: number,
  total: number
) => void;
type ResolveFunc = (param: any) => void;

/*
 Wraps an XMLHttpRequest to report the progress of a large file upload using
 an interface similar to the fetch API. A typical usage could take the form:

 async function doUpload(data: FormData) {
    const upload = new Upload(
        "http://example.com/upload",
        data,
        { 'Authorization': "Bearer XYZFOOBAR" }
    );
    upload.setListener((uploaded, total) => {
        // Report the uploaded and total bytes somwhere,
        // EG to a progress bar in a UI element.
    });
    try {
        const response = await upload.upload();
        if (response.status === 200) {
            const data = await request.json();
            // Do something on success with the response json data.
        } else {
            // Do something for HTTP errors
        }
    } catch (error) {
        if (error.message === "aborted") {
            // Do something on abort
        } else if (error.message === "error") {
            // Do something on connection errors
        } else {
            // Do something on unexpected errors
        }
    }
}

Upload.setListener() can be passed a ProgressEventListener which will
be called when the upload starts and when progress on the upload is
made with the total bytes sent and the total bytes to be sent.

The upload can be immediately cancelled by calling Upload.abort().

The returned promise from Upload.upload() will be rejected under
two circumstances:
  With Error("abort") if the abort method was called during upload
  With Error("error") if a connection error occurred, eg from a DNS
    problem or if the underlying connection dies.

If successfull, the promise returns a Response object populated with
status, status text, and body data.
*/
export class Upload {
  private _data: FormData;

  private _url: string;

  private _headers: Record<string, string>;

  private _xhr?: XMLHttpRequest;

  private _totalBytes = 0;

  private _sentBytes = 0;

  private _progressListener: ProgressEventListener | null = null;

  constructor(url: string, data: FormData, headers: Record<string, string>) {
    this._url = url;
    this._data = data;
    this._headers = headers;
  }

  /*
      Register a callback to be called when progress on the upload
      is made. This should be regestered before calling upload().
    */
  public setListener(listener: ProgressEventListener) {
    this._progressListener = listener;
  }

  public upload(): Promise<Response> {
    this._xhr = new XMLHttpRequest();
    return new Promise((resolve, reject) => {
      if (!this._xhr) {
        return;
      }
      this._xhr.open("POST", this._url, true);
      this._xhr.responseType = "blob";
      this._xhr.upload.addEventListener("progress", (e) =>
        this._updateProgress(e)
      );
      this._xhr.addEventListener("loadstart", (e) => this._updateProgress(e));
      this._xhr.addEventListener("load", () => {
        this._requestCompleted(resolve);
      });
      this._xhr.addEventListener("error", () => {
        reject(Error("error"));
      });
      this._xhr.addEventListener("abort", () => {
        reject(Error("abort"));
      });
      for (const header of Object.keys(this._headers)) {
        this._xhr.setRequestHeader(header, this._headers[header]);
      }
      this._xhr.send(this._data);
    });
  }

  /*
      Stop the upload.  If called mid-progress, the promise will be
      rejected with Error('abort').
    */
  public abort() {
    if (this._xhr) {
      this._xhr.abort();
    }
  }

  /*
      The bytes uploaded so far.
    */
  public getSentBytes() {
    return this._sentBytes;
  }

  /*
      The total bytes that will be sent unless an error occurs.
    */
  public getTotalBytes() {
    return this._totalBytes;
  }

  private _updateProgress(e: ProgressEvent<XMLHttpRequestEventTarget>) {
    this._totalBytes = e.total;
    this._sentBytes = e.loaded;
    this._publishProgress();
  }

  private _requestCompleted(resolve: ResolveFunc) {
    if (!this._xhr) {
      // Should be impossible to reach.
      throw Error("Logic Error: request was undefined");
    }
    this._sentBytes = this._totalBytes;
    this._publishProgress();

    // The resposne object exposes headers differently than an
    // XMLHttpRequest, so parse then out to be compatible with
    // its API. See:
    // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/getAllResponseHeaders#example
    const header_arr = this._xhr
      .getAllResponseHeaders()
      .trim()
      .split(/[\r\n]+/);

    // Create a map of header names to values
    const headers = new Headers();
    for (const line of header_arr) {
      const parts = line.split(": ");
      const header = parts.shift();
      if (header !== undefined) {
        const value = parts.join(": ");
        headers.append(header, value);
      }
    }

    resolve(
      new Response(this._xhr.response, {
        status: this._xhr.status,
        statusText: this._xhr.statusText,
        headers: headers,
      })
    );
  }

  private _publishProgress() {
    if (this._progressListener) {
      this._progressListener(this._sentBytes, this._totalBytes);
    }
  }
}
