import { Button } from '@babylonjs/gui';

export interface TacticalButtonSpec {
  id: string;
  text: string;
  width: string;
  height: string;
  primaryColor: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: string;
  thickness?: number;
}

export function createTacticalButton(spec: TacticalButtonSpec): Button {
  const btn = Button.CreateSimpleButton(spec.id, spec.text);
  btn.width = spec.width;
  btn.height = spec.height;
  btn.color = spec.primaryColor;
  btn.background = 'transparent';
  btn.thickness = spec.thickness ?? 2;
  btn.fontFamily = spec.fontFamily;
  btn.fontSize = spec.fontSize;
  btn.fontWeight = spec.fontWeight ?? '700';

  btn.onPointerEnterObservable.add((): void => {
    btn.background = spec.primaryColor;
    btn.color = 'black';
  });
  btn.onPointerOutObservable.add((): void => {
    btn.background = 'transparent';
    btn.color = spec.primaryColor;
  });

  return btn;
}

