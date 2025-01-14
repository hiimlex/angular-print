import { NgModule } from '@angular/core';
import { FeatherModule } from 'angular-feather';
import {
  CornerDownLeft,
  CornerDownRight,
  Crop,
  Edit2,
  Repeat,
  Square,
  Type,
} from 'angular-feather/icons';

const icons = {
  Crop,
  Type,
  Square,
  Edit2,
  CornerDownLeft,
  CornerDownRight,
  Repeat,
};

@NgModule({
  imports: [FeatherModule.pick(icons)],
  exports: [FeatherModule],
})
export class IconsModule {}
