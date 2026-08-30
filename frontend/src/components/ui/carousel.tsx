import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { EmblaCarouselType, EmblaOptionsType, EmblaPluginType } from 'embla-carousel';

import './carousel.css';

export type CarouselApi = EmblaCarouselType;

interface CarouselContextValue {
  api: CarouselApi | undefined;
  canScrollNext: boolean;
  canScrollPrev: boolean;
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  orientation: 'horizontal' | 'vertical';
  scrollNext: () => void;
  scrollPrev: () => void;
}

const CarouselContext = createContext<CarouselContextValue | null>(null);

interface CarouselProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  opts?: EmblaOptionsType;
  orientation?: 'horizontal' | 'vertical';
  plugins?: EmblaPluginType[];
  setApi?: (api: CarouselApi | undefined) => void;
}

export function Carousel({
  children,
  className = '',
  opts,
  orientation = 'horizontal',
  plugins,
  setApi,
  ...props
}: CarouselProps) {
  const [carouselRef, api] = useEmblaCarousel({
    ...opts,
    axis: orientation === 'vertical' ? 'y' : 'x',
  }, plugins);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const onSelect = useCallback((carouselApi: CarouselApi) => {
    setCanScrollPrev(carouselApi.canScrollPrev());
    setCanScrollNext(carouselApi.canScrollNext());
  }, []);

  useEffect(() => {
    if (!api) return;
    setApi?.(api);
    onSelect(api);
    api.on('reInit', onSelect);
    api.on('select', onSelect);
    return () => {
      api.off('reInit', onSelect);
      api.off('select', onSelect);
      setApi?.(undefined);
    };
  }, [api, onSelect, setApi]);

  const scrollPrev = useCallback(() => api?.scrollPrev(), [api]);
  const scrollNext = useCallback(() => api?.scrollNext(), [api]);

  return (
    <CarouselContext.Provider value={{ api, canScrollNext, canScrollPrev, carouselRef, orientation, scrollNext, scrollPrev }}>
      <div
        aria-roledescription="carousel"
        className={`ui-carousel ui-carousel--${orientation} ${className}`.trim()}
        role="region"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

interface CarouselContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CarouselContent({ children, className = '', ...props }: CarouselContentProps) {
  const { carouselRef, orientation } = useCarousel();
  return (
    <div className={`ui-carousel__viewport ui-carousel__viewport--${orientation}`} ref={carouselRef}>
      <div className={`ui-carousel__container ui-carousel__container--${orientation} ${className}`.trim()} {...props}>
        {children}
      </div>
    </div>
  );
}

interface CarouselItemProps extends HTMLAttributes<HTMLDivElement> {
  carouselIndex?: number;
  children: ReactNode;
  fade?: boolean;
  totalSlides?: number;
}

export function CarouselItem({ carouselIndex, children, className = '', fade = false, style, totalSlides, ...props }: CarouselItemProps) {
  const { api, orientation } = useCarousel();
  const [selectedIndex, setSelectedIndex] = useState(() => api?.selectedScrollSnap() ?? 0);

  useEffect(() => {
    if (!api) return;
    const updateSelectedIndex = () => setSelectedIndex(api.selectedScrollSnap());
    updateSelectedIndex();
    api.on('reInit', updateSelectedIndex);
    api.on('select', updateSelectedIndex);
    return () => {
      api.off('reInit', updateSelectedIndex);
      api.off('select', updateSelectedIndex);
    };
  }, [api]);

  const opacity = fade && carouselIndex !== undefined && totalSlides !== undefined
    ? carouselSlideOpacity(carouselIndex, selectedIndex, totalSlides)
    : undefined;
  const itemStyle: CSSProperties | undefined = opacity === undefined
    ? style
    : { ...style, opacity, transition: 'opacity 240ms ease-in-out' };

  return (
    <div
      aria-label={carouselIndex !== undefined && totalSlides !== undefined ? `${carouselIndex + 1} of ${totalSlides}` : undefined}
      aria-roledescription="slide"
      className={`ui-carousel__item ui-carousel__item--${orientation} ${className}`.trim()}
      data-carousel-slide-index={carouselIndex}
      data-carousel-active={carouselIndex !== undefined ? selectedIndex === carouselIndex : undefined}
      role="group"
      style={itemStyle}
      {...props}
    >
      {children}
    </div>
  );
}

interface CarouselControlProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
}

export function CarouselPrevious({ children, className = '', ...props }: CarouselControlProps) {
  const { canScrollPrev, orientation, scrollPrev } = useCarousel();
  return (
    <button
      aria-label={props['aria-label'] ?? `Previous ${orientation === 'vertical' ? 'gameweek' : 'round'}`}
      className={`ui-carousel__button ui-carousel__button--previous ${className}`.trim()}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      type="button"
      {...props}
    >
      {children ?? (orientation === 'vertical' ? <ChevronUp aria-hidden="true" size={17} /> : <ChevronLeft aria-hidden="true" size={17} />)}
    </button>
  );
}

export function CarouselNext({ children, className = '', ...props }: CarouselControlProps) {
  const { canScrollNext, orientation, scrollNext } = useCarousel();
  return (
    <button
      aria-label={props['aria-label'] ?? `Next ${orientation === 'vertical' ? 'gameweek' : 'round'}`}
      className={`ui-carousel__button ui-carousel__button--next ${className}`.trim()}
      disabled={!canScrollNext}
      onClick={scrollNext}
      type="button"
      {...props}
    >
      {children ?? (orientation === 'vertical' ? <ChevronDown aria-hidden="true" size={17} /> : <ChevronRight aria-hidden="true" size={17} />)}
    </button>
  );
}

export function useCarousel(): CarouselContextValue {
  const context = useContext(CarouselContext);
  if (!context) throw new Error('useCarousel must be used within a Carousel.');
  return context;
}

function carouselSlideOpacity(index: number, selectedIndex: number, totalSlides: number): number {
  if (totalSlides <= 1) return 1;
  const directDistance = Math.abs(index - selectedIndex);
  const loopDistance = totalSlides - directDistance;
  const distance = Math.min(directDistance, loopDistance);
  return distance === 0 ? 1 : distance === 1 ? 0.62 : 0.38;
}
