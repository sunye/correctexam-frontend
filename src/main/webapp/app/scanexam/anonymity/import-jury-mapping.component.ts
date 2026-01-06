/* eslint-disable @typescript-eslint/member-ordering */
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { DataUtils } from 'app/core/util/data-util.service';
import { MessageService, PrimeTemplate } from 'primeng/api';
import { FileUploadModule, type FileUploadHandlerEvent } from 'primeng/fileupload';
import { TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { BlockUIModule } from 'primeng/blockui';

import { AnonymityService } from '../services/anonymity.service';
import { IJuryMappingDTO } from './anonymity.model';

@Component({
  selector: 'jhi-import-jury-mapping',
  standalone: true,
  templateUrl: './import-jury-mapping.component.html',
  imports: [
    TranslateDirective,
    TranslatePipe,
    FileUploadModule,
    TableModule,
    Button,
    FormsModule,
    InputTextModule,
    ToastModule,
    BlockUIModule,
    PrimeTemplate,
  ],
  providers: [MessageService],
})
export class ImportJuryMappingComponent implements OnInit {
  examId = 0;
  blocked = signal(false);

  rows: IJuryMappingDTO[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dataUtils: DataUtils,
    private anonymityService: AnonymityService,
    private messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('examid');
      if (!id) return;

      this.examId = +id;
    });
  }

  gotoExam(): void {
    this.router.navigateByUrl('/exam/' + this.examId);
  }

  addRow(): void {
    this.rows = [...this.rows, { anonymousNumber: '', ine: '' }];
  }

  removeRow(i: number): void {
    this.rows = this.rows.filter((_, idx) => idx !== i);
  }

  protected loadFromFile(_event: unknown): void {
    const event = _event as FileUploadHandlerEvent;
    if (!event.files || event.files.length === 0) return;

    this.blocked.set(true);

    this.dataUtils.loadCSVFile(event.files[0], ';', data => {
      try {
        const header = data[0] ?? [];
        const idxAnon = header.indexOf('anonymousNumber');
        const idxIne = header.indexOf('ine');

        const hasHeader = idxAnon !== -1 && idxIne !== -1;
        const start = hasHeader ? 1 : 0;

        const parsed: IJuryMappingDTO[] = [];
        for (let i = start; i < data.length; i++) {
          const row = data[i];
          const anon = (hasHeader ? row[idxAnon] : row[0])?.trim();
          const ine = (hasHeader ? row[idxIne] : row[1])?.trim();

          if (!anon || !ine) continue;
          parsed.push({ anonymousNumber: anon, ine });
        }

        this.rows = parsed;

        this.messageService.add({
          severity: 'success',
          summary: 'OK',
          detail: `CSV chargé : ${parsed.length} ligne(s)`,
        });
      } catch (err: any) {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.message ?? 'Lecture CSV impossible',
        });
      } finally {
        this.blocked.set(false);
      }
    });
  }

  protected send(): void {
    const payload = this.rows
      .map(r => ({
        anonymousNumber: (r.anonymousNumber ?? '').trim(),
        ine: (r.ine ?? '').trim(),
      }))
      .filter(r => r.anonymousNumber.length > 0 && r.ine.length > 0);

    if (!this.examId) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: "examId manquant dans l'URL",
      });
      return;
    }

    this.blocked.set(true);
    this.anonymityService.importJuryMapping(this.examId, payload).subscribe({
      next: () =>
        this.messageService.add({
          severity: 'success',
          summary: 'OK',
          detail: `Mapping jury importé : ${payload.length} ligne(s)`,
        }),
      error: err =>
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.title ?? err?.message ?? 'Import impossible',
        }),
      complete: () => this.blocked.set(false),
    });
  }
}
