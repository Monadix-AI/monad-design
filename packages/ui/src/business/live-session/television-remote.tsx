export type TelevisionRemoteButton = 'up' | 'down' | 'left' | 'right' | 'select' | 'menu' | 'home' | 'playPause';

const stopCanvasEvent = (event: { stopPropagation: () => void }) => event.stopPropagation();

export function TelevisionRemote({
  assetUrl,
  disabled,
  onPress
}: {
  assetUrl?: (name: string) => string;
  disabled: boolean;
  onPress: (button: TelevisionRemoteButton) => void;
}) {
  const image = (name: string, className: string) =>
    assetUrl ? (
      <img
        alt=""
        aria-hidden="true"
        className={className}
        src={assetUrl(name)}
      />
    ) : null;

  return (
    <fieldset
      className="television-remote"
      data-canvas-ui
      disabled={disabled}
      onBlur={stopCanvasEvent}
      onClick={stopCanvasEvent}
      onContextMenu={stopCanvasEvent}
      onDoubleClick={stopCanvasEvent}
      onFocus={stopCanvasEvent}
      onKeyDown={stopCanvasEvent}
      onMouseDown={stopCanvasEvent}
      onMouseEnter={stopCanvasEvent}
      onMouseLeave={stopCanvasEvent}
      onMouseMove={stopCanvasEvent}
      onMouseOut={stopCanvasEvent}
      onMouseOver={stopCanvasEvent}
      onMouseUp={stopCanvasEvent}
      onPointerCancel={stopCanvasEvent}
      onPointerDown={stopCanvasEvent}
      onPointerEnter={stopCanvasEvent}
      onPointerLeave={stopCanvasEvent}
      onPointerMove={stopCanvasEvent}
      onPointerOut={stopCanvasEvent}
      onPointerOver={stopCanvasEvent}
      onPointerUp={stopCanvasEvent}
      onWheel={stopCanvasEvent}
    >
      <legend className="sr-only">Apple TV Remote</legend>
      {image('chrome', 'television-remote-chrome')}
      <div className="television-remote-clickpad">
        {image('ring', 'television-remote-ring')}
        {(['up', 'right', 'down', 'left'] as const).map((button) => (
          <button
            aria-label={`Remote ${button}`}
            className={`television-remote-direction television-remote-${button}`}
            key={button}
            onClick={() => onPress(button)}
            type="button"
          />
        ))}
        <button
          aria-label="Remote Select"
          className="television-remote-select"
          onClick={() => onPress('select')}
          type="button"
        />
      </div>
      <button
        aria-label="Remote Back"
        className="television-remote-action television-remote-menu"
        onClick={() => onPress('menu')}
        type="button"
      >
        {image('menu', 'television-remote-glyph')}
      </button>
      <button
        aria-label="Remote Home"
        className="television-remote-action television-remote-home"
        onClick={() => onPress('home')}
        type="button"
      >
        {image('tv', 'television-remote-glyph')}
      </button>
      <button
        aria-label="Remote Play/Pause"
        className="television-remote-action television-remote-play"
        onClick={() => onPress('playPause')}
        type="button"
      >
        {image('playPause', 'television-remote-glyph')}
      </button>
    </fieldset>
  );
}
