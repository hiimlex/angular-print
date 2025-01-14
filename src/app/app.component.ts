import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { PrintService } from './print.service';
import { IconsModule } from './icons.module';
import { last } from 'rxjs';

import mergeImages from 'merge-images';

import { ImageCroppedEvent, ImageCropperComponent } from 'ngx-image-cropper';

type CanvasMode = 'start' | 'crop' | 'text' | 'rect' | 'line' | 'undo' | 'redo';
type CanvasAction = {
  mode: CanvasMode;
  canvasPrint: string;
  index: number;
};

@Component({
  selector: 'app-root',
  imports: [CommonModule, IconsModule, ImageCropperComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.less',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('canvasRef', { static: false })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild('previewRef', { static: false })
  previewRef!: ElementRef<HTMLImageElement>;

  canvasMode?: CanvasMode = undefined;

  actionStack: CanvasAction[] = [];
  actionIndex = -1;
  preview = '';

  mouseUp?: (mouse: MouseEvent) => void;
  mouseDown?: (mouse: MouseEvent) => void;
  mouseMove?: (mouse: MouseEvent) => void;
  mouseOut?: (mouse: MouseEvent) => void;

  canvasWidth = 800;
  aspectRatio = parseFloat((16 / 9).toFixed(2));
  canvasHeight = this.canvasWidth / this.aspectRatio;

  showPreview = true;
  showCanvas = true;

  cropEvent!: ImageCroppedEvent;

  get print(): string {
    return this.printService.print;
  }

  get isRecording(): boolean {
    return this.printService.recording;
  }

  get b64ToCrop(): string {
    return this.preview.replace('data:image/png;base64,', '');
  }

  constructor(
    private printService: PrintService,
    private cdr: ChangeDetectorRef
  ) {}

  // Keyboard shortcuts
  @HostListener('document:keydown.control.s', ['$event'])
  onShortcut(event: KeyboardEvent) {
    event.preventDefault();
    this.stopRecording();
  }
  // Start recording the user screen
  startRecording() {
    this.clearCanvas();
    this.preview = '';
    this.actionIndex = -1;
    this.actionStack = [];

    this.printService.startRecording();
  }
  // Stop recording the user screen, and generate the print
  stopRecording() {
    this.printService.stopRecording();
  }

  // Canvas actions
  selectCanvasMode(mode: CanvasMode): void {
    this.removeCanvasEventListeners();

    if (mode === this.canvasMode) {
      this.canvasMode = undefined;
      this.showCanvas = true;
      this.showPreview = true;

      return;
    }

    this.canvasMode = mode;

    if (mode === 'rect') {
      this.setSquareMode();
    }

    if (mode === 'line') {
      this.setLineMode();
    }

    if (mode === 'crop') {
      this.setCropMode();
    }
  }
  // add event listener to canvas
  addCanvasEventListeners(): void {
    this.mouseDown &&
      this.canvasRef.nativeElement.addEventListener(
        'mousedown',
        this.mouseDown
      );
    this.mouseUp &&
      this.canvasRef.nativeElement.addEventListener('mouseup', this.mouseUp);
    this.mouseMove &&
      this.canvasRef.nativeElement.addEventListener(
        'mousemove',
        this.mouseMove
      );
    this.mouseOut &&
      this.canvasRef.nativeElement.addEventListener('mouseout', this.mouseOut);
  }
  // remove all event listeners from canvas
  removeCanvasEventListeners(): void {
    this.mouseDown &&
      this.canvasRef.nativeElement.removeEventListener(
        'mousedown',
        this.mouseDown
      );

    this.mouseUp &&
      this.canvasRef.nativeElement.removeEventListener('mouseup', this.mouseUp);
    this.mouseMove &&
      this.canvasRef.nativeElement.removeEventListener(
        'mousemove',
        this.mouseMove
      );

    this.mouseDown = undefined;
    this.mouseUp = undefined;
    this.mouseMove = undefined;
  }

  // Set square mode
  private setSquareMode(): void {
    // const canvas = document.getElementById('canvasTest') as HTMLCanvasElement;
    // const ctx = canvas.getContext('2d')!;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;

    let startX = 0;
    let startY = 0;
    let mouseX = 0;
    let mouseY = 0;
    let offsetX = canvas.offsetLeft;
    let offsetY = canvas.offsetTop;
    let isDragging = false;

    this.mouseDown = (event: MouseEvent) => {
      mouseX = event.offsetX;
      mouseY = event.offsetY;

      startX = mouseX;
      startY = mouseY;

      isDragging = true;
    };

    this.mouseUp = (event: MouseEvent) => {
      isDragging = false;

      this.addActionStack('rect');
    };

    this.mouseMove = (event: MouseEvent) => {
      mouseX = event.offsetX;
      mouseY = event.offsetY;

      if (!isDragging) {
        return;
      }

      ctx.reset();

      ctx.fillStyle = 'transparent';
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 3;

      const width = mouseX - startX;
      const height = mouseY - startY;

      ctx.beginPath();
      ctx.rect(startX, startY, width, height);
      ctx.fill();
      ctx.stroke();
    };

    this.mouseOut = (event: MouseEvent) => {
      isDragging = false;
      this.clearCanvas();
    };

    this.addCanvasEventListeners();
  }
  // set line mode
  private setLineMode(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;

    let prevX = 0;
    let prevY = 0;
    let currX = 0;
    let currY = 0;
    let offsetX = canvas.offsetLeft;
    let offsetY = canvas.offsetTop;
    let isDragging = false;

    console.log(canvas.offsetLeft, canvas.offsetTop);

    ctx.reset();

    ctx.fillStyle = 'transparent';
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const updateCurrentPosition = (e: MouseEvent) => {
      prevX = currX;
      prevY = currY;

      currX = e.offsetX;
      currY = e.offsetY;
    };

    this.mouseDown = (e: MouseEvent) => {
      updateCurrentPosition(e);

      isDragging = true;
    };

    this.mouseUp = (event: MouseEvent) => {
      isDragging = false;

      this.addActionStack('line');
    };

    this.mouseMove = (e: MouseEvent) => {
      if (isDragging) {
        updateCurrentPosition(e);

        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(currX, currY);
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.closePath();
      }
    };

    this.mouseOut = (event: MouseEvent) => {
      isDragging = false;
      this.clearCanvas();
    };

    this.addCanvasEventListeners();
  }

  // Set crop mode
  private setCropMode(): void {
    this.showCanvas = false;
    this.showPreview = false;

    this.cdr.detectChanges();
    this.cdr.markForCheck();
  }

  onImageCropped(event: ImageCroppedEvent): void {
    this.cropEvent = event;
  }

  confirmCrop(): void {
    this.showCanvas = true;
    this.showPreview = true;

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;

    const img = new Image();
    img.src = this.b64ToCrop;
  }

  // Draw print image on canvas
  private drawImageOnCanvas() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.src = this.print;

    img.onload = () => {
      const isPortrait = img.width < img.height;

      const aspectRatio = parseFloat((img.width / img.height).toFixed(2));

      let canvasWidth = canvas.width;
      let canvasHeight = canvasWidth / this.aspectRatio;

      if (isPortrait) {
        this.aspectRatio = aspectRatio;
        canvasHeight = 720;
        canvasWidth = canvasHeight * this.aspectRatio;
      }

      // apply new size to canvas
      this.canvasWidth = canvasWidth;
      this.canvasHeight = canvasHeight;

      canvas.width = this.canvasWidth;
      canvas.height = this.canvasHeight;

      ctx.drawImage(img, 0, 0, this.canvasWidth, this.canvasHeight);

      this.addActionStack('start');

      this.cdr.detectChanges();
      this.cdr.markForCheck();
    };
  }

  // Clear canvas
  private clearCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Get last action from action stack and apply to canvas
  undo(): void {
    // back to last action
    this.actionIndex--;

    this.generatePreview();
  }

  // Get next action from action stack and apply to canvas
  redo(): void {
    // forward to next action
    this.actionIndex++;

    this.generatePreview();
  }

  // Reset all changes
  reset(): void {
    this.clearCanvas();
    this.actionIndex = -1;
    this.actionStack = [];
    this.preview = '';

    if (this.print) {
      this.drawImageOnCanvas();
    }
  }

  // Add action to canvas action stack
  private addActionStack(action: CanvasMode): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;

    const canvasPrint = canvas.toDataURL('image/png');

    this.actionIndex++;
    // adding action into stack index
    this.actionStack[this.actionIndex] = {
      mode: action,
      canvasPrint,
      index: this.actionIndex,
    };

    // clearing all actions after current action index
    this.actionStack.splice(this.actionIndex + 1);
    // clearing canvas for next interaction
    this.clearCanvas();
    // generating frame from all actions
    this.generatePreview();
  }

  // Generate preview from action stack
  private async generatePreview(): Promise<void> {
    const frames: { src: string | undefined }[] = this.actionStack.map(
      (action) => {
        if (action.index <= this.actionIndex) {
          return { src: action.canvasPrint };
        }

        return { src: undefined };
      }
    );
    const filteredFrames = frames.filter((frame) => !!frame && !!frame.src);

    const b64 = await mergeImages(filteredFrames as any);

    this.preview = b64;

    this.cdr.detectChanges();
    this.cdr.markForCheck();
  }

  // Get print from print service
  private getPrint(): void {
    this.printService.$print.subscribe((print) => {
      this.drawImageOnCanvas();

      this.cdr.detectChanges();
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.getPrint();
  }
}
