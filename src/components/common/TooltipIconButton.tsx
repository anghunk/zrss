import * as React from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type TooltipSide = React.ComponentProps<typeof TooltipContent>['side'];
type TooltipAlign = React.ComponentProps<typeof TooltipContent>['align'];

export interface TooltipIconButtonProps
  extends Omit<ButtonProps, 'children' | 'size' | 'title' | 'aria-label'> {
  /** 图标按钮内展示的图标内容。 */
  children: React.ReactNode;
  /** 鼠标悬浮或键盘聚焦时显示的提示内容。 */
  tooltip: React.ReactNode;
  /** 图标按钮的无障碍名称，未传时会优先复用纯文本 tooltip。 */
  ariaLabel?: string;
  /** Tooltip 相对按钮出现的位置。 */
  tooltipSide?: TooltipSide;
  /** Tooltip 和按钮的对齐方式。 */
  tooltipAlign?: TooltipAlign;
  /** Tooltip 浮层的额外样式。 */
  tooltipClassName?: string;
}

/**
 * 带 Tooltip 的图标按钮，统一处理快速移动鼠标时的提示显隐。
 */
export const TooltipIconButton = React.forwardRef<
  HTMLButtonElement,
  TooltipIconButtonProps
>(
  (
    {
      children,
      tooltip,
      ariaLabel,
      tooltipSide = 'bottom',
      tooltipAlign = 'center',
      tooltipClassName,
      className,
      disabled,
      onBlur,
      onClick,
      onFocus,
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const accessibleLabel =
      ariaLabel || (typeof tooltip === 'string' ? tooltip : undefined);

    /**
     * 打开当前按钮的悬浮提示。
     */
    const showTooltip = React.useCallback(() => {
      setOpen(true);
    }, []);

    /**
     * 立即关闭当前按钮的悬浮提示。
     */
    const hideTooltip = React.useCallback(() => {
      setOpen(false);
    }, []);

    return (
      <TooltipProvider>
        <Tooltip open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <span
              className="inline-flex"
              onPointerEnter={showTooltip}
              onPointerLeave={hideTooltip}
            >
              <Button
                ref={ref}
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8', className)}
                disabled={disabled}
                aria-label={accessibleLabel}
                onFocus={(event) => {
                  showTooltip();
                  onFocus?.(event);
                }}
                onBlur={(event) => {
                  hideTooltip();
                  onBlur?.(event);
                }}
                onClick={(event) => {
                  hideTooltip();
                  onClick?.(event);
                }}
                {...props}
              >
                {children}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent
            side={tooltipSide}
            align={tooltipAlign}
            className={tooltipClassName}
          >
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);
TooltipIconButton.displayName = 'TooltipIconButton';
