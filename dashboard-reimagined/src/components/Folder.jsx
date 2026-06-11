import React from 'react';

// Base Folder Component with customizable height and tabX offset
export const Folder = ({ 
  height, 
  tabX, 
  backgroundColor, 
  textColor, 
  isActive, 
  index, 
  onClick, 
  label, 
  count, 
  isLight,
  bodyZ,
  tabZ,
  children 
}) => {
  return (
    <>
      {/* Folder Tab */}
      <div 
        onClick={onClick}
        className={`folder-tab-container ${isActive ? 'active' : ''} pointer-events-auto`}
        style={{
          left: tabX,
          bottom: height, // sits right on top of the card body
          zIndex: tabZ,
          position: 'absolute'
        }}
      >
        <div 
          className="folder-tab-trapezoid font-semibold"
          style={{
            backgroundColor,
            color: textColor
          }}
        >
          <div 
            className="folder-index-badge"
            style={{
              backgroundColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)'
            }}
          >
            {index === 0 ? '00' : index.toString().padStart(2, '0')}
          </div>
          <span className="max-w-[120px] truncate">{label}</span>
          <span className="text-[10px] opacity-75 font-mono font-bold">({count})</span>
        </div>
      </div>

      {/* Folder Body Card */}
      <div 
        className={`folder-body-card flex flex-col transition-all duration-300 pointer-events-auto ${
          isActive ? 'opacity-100 visible shadow-2xl' : 'opacity-100 visible'
        } ${isLight ? 'text-zinc-900 border-zinc-900/10' : 'text-[#f5f2eb] border-white/5'}`}
        style={{
          height,
          backgroundColor,
          color: textColor,
          width: '100%',
          position: 'absolute',
          bottom: 0,
          left: 0,
          zIndex: bodyZ
        }}
      >
        {isActive ? children : null}
      </div>
    </>
  );
};

export default Folder;
