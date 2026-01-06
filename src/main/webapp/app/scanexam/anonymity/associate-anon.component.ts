/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable prefer-const */
/* eslint-disable no-console */
import { AfterViewInit, Component, HostListener, ViewChild, effect, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService, SelectItem, PrimeTemplate } from 'primeng/api';
import { firstValueFrom } from 'rxjs';

import { ExamService } from 'app/entities/exam/service/exam.service';
import { ExamSheetService } from 'app/entities/exam-sheet/service/exam-sheet.service';
import { CacheServiceImpl } from 'app/scanexam/db/CacheServiceImpl';
import { AlignImagesService } from 'app/scanexam/services/align-images.service';
import { ZoneService } from 'app/entities/zone/service/zone.service';
import { PreferenceService } from 'app/scanexam/preference-page/preference.service';

import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ShortcutInput, KeyboardShortcutsModule } from 'ng-keyboard-shortcuts';
import { Listbox, ListboxModule } from 'primeng/listbox';
import { PaginatorModule } from 'primeng/paginator';
import { NgClass } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ButtonDirective, Button } from 'primeng/button';
import { SliderModule } from 'primeng/slider';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DrawerModule } from 'primeng/drawer';
import { GalleriaModule } from 'primeng/galleria';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { BlockUIModule } from 'primeng/blockui';
import { ToastModule } from 'primeng/toast';
import { ProgressBarModule } from 'primeng/progressbar';

import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { AnonymityService } from '../services/anonymity.service';
import type { IAnonymityExamDTO } from './anonymity.model';
import type { IExam } from 'app/entities/exam/exam.model';
import type { IExamSheet } from 'app/entities/exam-sheet/exam-sheet.model';
import type { IZone } from 'app/entities/zone/zone.model';
import { DoPredictionsInputSamePage } from 'app/opencv.worker';

interface PredictResult {
  ineImage?: ImageData;
  ineImageDebug?: ImageData;
  ineText?: string;
  page: number;
}

@Component({
  selector: 'jhi-associate-anon',
  templateUrl: './associate-anon.component.html',
  styleUrls: ['./associate-anon.component.scss'],
  providers: [MessageService],
  standalone: true,
  imports: [
    ToastModule,
    BlockUIModule,
    ProgressSpinnerModule,
    GalleriaModule,
    PrimeTemplate,
    KeyboardShortcutsModule,
    DrawerModule,
    ToggleSwitchModule,
    FormsModule,
    TooltipModule,
    SliderModule,
    ButtonDirective,
    FaIconComponent,
    Button,
    PaginatorModule,
    ListboxModule,
    NgClass,
    TranslateDirective,
    TranslatePipe,
    ProgressBarModule,
  ],
})
export class AssociateAnonComponent implements AfterViewInit {
  @ViewChild('list') list: Listbox | undefined;

  remainingFree = signal(0);

  blocked = false;
  examId = 0;
  exam!: IExam;

  nbreFeuilleParCopie = 0;
  numberPagesInScan = 0;
  totalCopies = 0;

  currentStudent = 0;
  currentSheetId: number | null = null;

  layoutsidebarVisible = false;
  debug = false;
  noalign = false;
  factor = 1;

  zoneine!: IZone;
  ineImageImg?: string;
  ineImageImgDebug?: string;
  columnstyle = { width: '100%' };

  activeIndex = 1;
  displayBasic = false;
  images: any[] = [];
  responsiveOptions2: any[] = [
    { breakpoint: '1500px', numVisible: 5 },
    { breakpoint: '1024px', numVisible: 3 },
    { breakpoint: '768px', numVisible: 2 },
    { breakpoint: '560px', numVisible: 1 },
  ];

  shortcuts: ShortcutInput[] = [];

  allAnon: IAnonymityExamDTO[] = [];
  filterAssignedAnon = true;

  anonOptions: SelectItem[] = [];
  currentAnon: IAnonymityExamDTO | null = null;

  currentIne = '';

  faArrowLeft = faArrowLeft;

  constructor(
    public examService: ExamService,
    public examsheetService: ExamSheetService,
    public zoneService: ZoneService,
    protected activatedRoute: ActivatedRoute,
    public router: Router,
    public messageService: MessageService,
    private db: CacheServiceImpl,
    private preferenceService: PreferenceService,
    private translateService: TranslateService,
    private alignImagesService: AlignImagesService,
    private anonymityService: AnonymityService,
  ) {}

  ngAfterViewInit(): void {
    this.shortcuts.push(
      {
        key: ['ctrl + right', 'cmd + right'],
        label: 'Navigation',
        description: 'Next',
        command: () => this.nextStudent(),
        preventDefault: true,
      },
      {
        key: ['ctrl + left', 'cmd + left'],
        label: 'Navigation',
        description: 'Previous',
        command: () => this.previousStudent(),
        preventDefault: true,
      },
      {
        key: ['ctrl + enter', 'cmd + enter'],
        label: 'Bind',
        description: 'Bind + Next',
        command: () => this.bindAnonToCurrentSheet(true),
        preventDefault: true,
      },
    );

    this.activatedRoute.paramMap.subscribe(params => {
      this.blocked = true;
      const id = params.get('examid');
      if (!id) return;

      this.examId = +id;

      let p = params.get('currentStudent');
      this.currentStudent = p ? +p - 1 : 0;

      this.loadAll().finally(() => (this.blocked = false));
    });
  }

  async loadAll(): Promise<void> {
    console.time('associateAnon_loadAll');
    try {
      const promises: Promise<any>[] = [];
      promises.push(this.db.countPageTemplate(this.examId));
      promises.push(this.db.countAlignImage(this.examId));
      promises.push(firstValueFrom(this.examService.find(this.examId)));
      promises.push(firstValueFrom(this.anonymityService.getAnonNumbers(this.examId)));

      const [tplCount, alignCount, examResp, anonList] = await Promise.all(promises);

      this.nbreFeuilleParCopie = tplCount;
      this.numberPagesInScan = alignCount;
      this.totalCopies = Math.floor(this.numberPagesInScan / this.nbreFeuilleParCopie);

      this.exam = examResp.body!;
      this.allAnon = anonList ?? [];

      await this.loadZones();
      await this.refreshCurrentSheetId();
      await this.refreshAnonListLocal();
      await this.loadImage();
      this.countRemainingFree();
    } catch (e: any) {
      this.messageService.add({ severity: 'error', summary: 'Erreur', detail: e?.message ?? 'loadAll failed' });
    }
  }

  async loadZones(): Promise<void> {
    const zones = (await firstValueFrom(this.zoneService.find4ExamId(this.examId)))?.body;
    if (!zones || zones.length === 0) return;

    if (zones[2]?.id) this.zoneine = zones[2];
  }

  async refreshCurrentSheetId(): Promise<void> {
    const pagemin = this.currentStudent * this.nbreFeuilleParCopie;
    const pagemax = (this.currentStudent + 1) * this.nbreFeuilleParCopie - 1;

    const sheetsResp = await firstValueFrom(
      this.examsheetService.query({
        scanId: this.exam.scanfileId,
        pagemin,
        pagemax,
      }),
    );

    const sheets = sheetsResp.body ?? [];
    const sheet = sheets.length > 0 ? sheets[0] : null;
    this.currentSheetId = sheet?.id ?? null;

    const students: any[] = (sheet as any)?.students ?? [];
    const ines = students.map(s => s?.ine).filter(Boolean);
    this.currentIne = ines.length ? ines.join(' - ') : '';
  }

  refreshAnonListLocal(): void {
    const list = this.filterAssignedAnon ? this.allAnon.filter(a => !a.sheetId) : this.allAnon;

    this.anonOptions = list.map(a => ({
      value: a,
      label: a.anonymousNumber + (a.sheetId ? ` (sheet ${a.sheetId})` : ''),
    }));

    if (this.currentAnon && !list.some(x => x.anonymousNumber === this.currentAnon!.anonymousNumber)) {
      this.currentAnon = null;
    }

    if (!this.currentAnon && this.anonOptions.length > 0) {
      this.currentAnon = this.anonOptions[0].value as IAnonymityExamDTO;
    }
  }

  onAnonSelected(v: IAnonymityExamDTO): void {
    this.currentAnon = v;
  }

  anonColor(item: any): string {
    return item?.value?.sheetId ? 'text-orange-400' : 'text-green-400';
  }

  async selectAnonAndBind(v: IAnonymityExamDTO): Promise<void> {
    this.currentAnon = v;
    await this.bindAnonToCurrentSheet(true);
  }

  async bindAnonToCurrentSheet(goNext: boolean): Promise<void> {
    if (!this.currentAnon || !this.currentSheetId) return;

    this.blocked = true;
    try {
      const payload = [
        {
          anonymousNumber: this.currentAnon.anonymousNumber,
          examId: this.examId,
          sheetId: this.currentSheetId,
        },
      ];

      await firstValueFrom(this.anonymityService.associateAnon(this.examId, payload as any));

      const found = this.allAnon.find(a => a.anonymousNumber === this.currentAnon!.anonymousNumber);
      if (found) found.sheetId = this.currentSheetId;

      this.messageService.add({ severity: 'success', summary: 'OK', detail: 'Association enregistrée' });

      this.refreshAnonListLocal();

      if (goNext) this.nextStudent();
    } catch (e: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: e?.error?.title ?? e?.message ?? 'Impossible d’associer',
      });
    } finally {
      this.blocked = false;
    }
  }

  gotoExam(): void {
    this.router.navigateByUrl('/exam/' + this.examId);
  }

  goToStudent(i: number): void {
    if (i >= 0 && i < this.totalCopies) {
      this.router.navigateByUrl('/exam/associateAnon/' + this.examId + '/' + (i + 1));
    }
  }

  nextStudent(): void {
    if (this.currentStudent + 1 < this.totalCopies) this.goToStudent(this.currentStudent + 1);
  }

  previousStudent(): void {
    if (this.currentStudent - 1 >= 0) this.goToStudent(this.currentStudent - 1);
  }

  onPageChange($event: any): void {
    this.goToStudent($event.page);
  }

  reloadImageGrowFactor(event: any): void {
    if (event.value !== this.factor) {
      this.factor = event.value;
      this.loadImage();
    }
  }

  imagedata_to_image(imagedata: ImageData): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = imagedata.width;
    canvas.height = imagedata.height;
    ctx?.putImageData(imagedata, 0, 0);
    return canvas.toDataURL();
  }

  async loadImage(): Promise<void> {
    if (!this.zoneine?.id) return;

    const page = this.currentStudent * this.nbreFeuilleParCopie;
    const res = await this.predictINE([page]);

    if (res.length === 1) {
      if (res[0].ineImage) this.ineImageImg = this.imagedata_to_image(res[0].ineImage);
      if (this.debug && res[0].ineImageDebug) this.ineImageImgDebug = this.imagedata_to_image(res[0].ineImageDebug);
    }
  }

  async predictINE(pagesToAnalyze: number[]): Promise<PredictResult[]> {
    const pageTemplate = this.zoneine.pageNumber ?? 0;

    const r: DoPredictionsInputSamePage = {
      align: !this.noalign,
      candidates: [],
      examId: this.examId,
      indexDb: this.preferenceService.getPreference().cacheDb === 'indexdb',
      factor: this.factor,
      pagesToAnalyze: pagesToAnalyze.map(p => p + pageTemplate),
      pageTemplate,
      nameZone: undefined as any,
      firstnameZone: undefined as any,
      ineZone: this.zoneine as any,
      removeHorizontal: this.preferenceService.getPreference().removeHorizontalName,
      looking4missing: true,
      preferences: this.preferenceService.getPreference(),
      assist: false,
      debug: this.debug,
    };

    const r5 = await firstValueFrom(this.alignImagesService.doPredictions(r));

    const out: PredictResult[] = [];
    for (const r1 of r5) {
      const pr: PredictResult = { page: r1.page };
      if (r1.ineZone) {
        pr.ineImage = new ImageData(new Uint8ClampedArray(r1.ineZone), r1.ineZoneW!, r1.ineZoneH!);
        if (this.debug && r1.ineZoneDebug) {
          pr.ineImageDebug = new ImageData(new Uint8ClampedArray(r1.ineZoneDebug), r1.ineZoneW!, r1.ineZoneH!);
        }
      }
      out.push(pr);
    }
    return out;
  }

  showGalleria(): void {
    this.blocked = true;
    this.loadAllPages().then(() => {
      this.blocked = false;
      this.displayBasic = true;
    });
  }

  @HostListener('document:keydown.escape', ['$event'])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onKeydownHandler(event: KeyboardEvent): void {
    this.displayBasic = false;
  }

  loadAllPages(): Promise<void> {
    this.images = [];
    return new Promise<void>(resolve => {
      this.db.countNonAlignImage(this.examId).then(page => {
        if (page > 30) {
          this.activeIndex = 0;
          this.db.countPageTemplate(this.examId).then(page1 => {
            if (this.noalign) {
              this.db
                .getNonAlignImageBetweenAndSortByPageNumber(this.examId, this.currentStudent * page1 + 1, (this.currentStudent + 1) * page1)
                .then(e1 => {
                  e1.forEach(e => {
                    const image = JSON.parse(e!.value, this.reviver);
                    this.images.push({ src: image.pages, alt: 'Exam', title: 'Exam' });
                  });
                  resolve();
                });
            } else {
              this.db
                .getAlignImageBetweenAndSortByPageNumber(this.examId, this.currentStudent * page1 + 1, (this.currentStudent + 1) * page1)
                .then(e1 => {
                  e1.forEach(e => {
                    const image = JSON.parse(e!.value, this.reviver);
                    this.images.push({ src: image.pages, alt: 'Exam', title: 'Exam' });
                  });
                  resolve();
                });
            }
          });
        } else {
          if (this.noalign) {
            this.db.getNonAlignSortByPageNumber(this.examId).then(e1 => {
              e1.forEach(e => {
                const image = JSON.parse(e!.value, this.reviver);
                this.images.push({ src: image.pages, alt: 'Exam', title: 'Exam' });
              });
              resolve();
            });
          } else {
            this.db.getAlignSortByPageNumber(this.examId).then(e1 => {
              e1.forEach(e => {
                const image = JSON.parse(e!.value, this.reviver);
                this.images.push({ src: image.pages, alt: 'Exam', title: 'Exam' });
              });
              resolve();
            });
          }
        }
      });
    });
  }

  private reviver(key: any, value: any): any {
    if (typeof value === 'object' && value !== null) {
      if (value.dataType === 'Map') return new Map(value.value);
    }
    return value;
  }

  countRemainingFree(): void {
    const assigned = this.allAnon.filter(a => !!a.sheetId).length;
    const total = this.allAnon.length || 1;
    this.remainingFree.set((assigned / total) * 100);
  }

  resetAllAnonBindings(): void {
    this.messageService.add({
      severity: 'info',
      summary: 'TODO',
      detail: 'TODO',
    });
  }
}
