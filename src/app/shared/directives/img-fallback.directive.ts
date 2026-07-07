import { Directive, ElementRef, HostListener, inject } from '@angular/core';

/** 1×1 transparent PNG — shown in place of a broken image */
const TRANSPARENT_PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Gracefully handles broken images: on load error, swaps the source for a
 * transparent pixel and tags the element so CSS can style the gap if desired.
 * Reused across draft slots, puzzle/quiz icons and the champion pool.
 *
 *   <img [src]="champIcon(id)" appImgFallback />
 */
@Directive({
  selector: 'img[appImgFallback]',
  standalone: true,
})
export class ImgFallbackDirective {
  private el = inject(ElementRef<HTMLImageElement>);

  @HostListener('error')
  onError() {
    const img = this.el.nativeElement as HTMLImageElement;
    if (img.src === TRANSPARENT_PX) return; // avoid loops
    img.src = TRANSPARENT_PX;
    img.classList.add('img-broken');
  }
}
