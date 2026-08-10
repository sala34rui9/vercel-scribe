import React from 'react';
import { ImageModel, ImageStyle, ImageRatio } from '../../../services/imagePresets';
import { Settings2, Image as ImageIcon } from 'lucide-react';

interface ImageSettingsSectionProps {
  imageCount: number;
  onImageCountChange: (count: number) => void;
  imageModel: ImageModel;
  onImageModelChange: (model: ImageModel) => void;
  imageStyle: ImageStyle;
  onImageStyleChange: (style: ImageStyle) => void;
  imageRatio: ImageRatio;
  onImageRatioChange: (ratio: ImageRatio) => void;
}

export const ImageSettingsSection: React.FC<ImageSettingsSectionProps> = ({
  imageCount,
  onImageCountChange,
  imageModel,
  onImageModelChange,
  imageStyle,
  onImageStyleChange,
  imageRatio,
  onImageRatioChange,
}) => {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-orange-400 to-orange-600"></div>
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center">
            <ImageIcon className="w-5 h-5 mr-2 text-orange-500" />
            Image Generation
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Model</label>
            <select
              value={imageModel}
              onChange={(e) => onImageModelChange(e.target.value as ImageModel)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm bg-white"
            >
              {/* Options populated by parent via MODEL_PRESETS if needed, or hardcoded here */}
              <option value="sdxl">SDXL — Best Quality</option>
              <option value="sd">Stable Diffusion — Fast</option>
              <option value="flux">Flux — Balanced</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Number of Images</label>
            <select
              value={imageCount}
              onChange={(e) => onImageCountChange(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm bg-white"
            >
              <option value="0">None</option>
              <option value="1">1 Featured Image</option>
              <option value="2">2 Images</option>
              <option value="3">3 Images</option>
              <option value="4">4 Images</option>
              <option value="5">5 Images</option>
            </select>
          </div>

          {imageCount > 0 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Style</label>
                <select
                  value={imageStyle}
                  onChange={(e) => onImageStyleChange(e.target.value as ImageStyle)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm bg-white"
                >
                  <option value="photorealistic">Photorealistic</option>
                  <option value="illustration">Illustration</option>
                  <option value="minimal">Minimal</option>
                  <option value="abstract">Abstract</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Aspect Ratio</label>
                <select
                  value={imageRatio}
                  onChange={(e) => onImageRatioChange(e.target.value as ImageRatio)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-sm bg-white"
                >
                  <option value="16:9">16:9 — Wide Banner</option>
                  <option value="4:3">4:3 — Standard</option>
                  <option value="1:1">1:1 — Square</option>
                  <option value="3:2">3:2 — Photo</option>
                </select>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-sm text-slate-600">
            Automatically generate and embed {imageCount === 1 ? 'a featured image' : 'images'} in your article using Cloudflare Workers AI.
          </p>
          <p className="text-xs text-slate-400 mt-2 flex items-center bg-slate-50 p-2 rounded border border-slate-100">
            <Settings2 className="w-3 h-3 mr-1.5 text-slate-400" />
            Requires Cloudflare URL and Token to be configured in SEO → Settings
          </p>
        </div>
      </div>
    </div>
  );
};
