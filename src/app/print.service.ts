import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PrintService {
  private mediaRecorder!: MediaRecorder;
  private stream!: MediaStream;
  recordedChunks: Blob[] = [];
  print!: string;
  recording = false;

  $print = new Subject<string>();

  async startRecording() {
    this.recording = true;

    this.stream = await navigator.mediaDevices.getDisplayMedia({
      preferCurrentTab: true,
    } as any);

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: 'video/webm; codecs=vp8',
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
        this.captureFrame(event.data);
      }
    };

    this.mediaRecorder.start();

    setTimeout(() => {
      this.recording = false;

      this.stopRecording();
    }, 300);
  }

  stopRecording() {
    this.mediaRecorder.stop();
    this.stream.getTracks().forEach((track) => track.stop());
  }

  private async captureFrame(blob: Blob) {
    try {
      const video = document.createElement('video');
      const blobAsUrl = URL.createObjectURL(blob);
      video.src = blobAsUrl;

      // Wait for the metadata to load
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = (error) =>
          reject(new Error('Video metadata loading failed.'));
      });

      // Play the video briefly to render a frame

      video.currentTime = 0;
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        video.play();
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      this.print = canvas.toDataURL('image/png');

      this.$print.next(this.print);
    } catch (error) {
      console.error('Error capturing frame:', error);
    }
  }
}
