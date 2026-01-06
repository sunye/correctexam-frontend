/* eslint-disable @typescript-eslint/member-ordering */
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MessageService, PrimeTemplate } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { BlockUIModule } from 'primeng/blockui';
import FileSaver from 'file-saver';

import { AnonymityService } from '../services/anonymity.service';
import { IAnonGradeLine } from './anonymity.model';

@Component({
  selector: 'jhi-export-grades-anon',
  standalone: true,
  templateUrl: './export-grades-anon.component.html',
  imports: [TranslatePipe, TableModule, Button, ToastModule, BlockUIModule, PrimeTemplate],
  providers: [MessageService],
})
export class ExportGradesAnonComponent implements OnInit {
  examId = 0;
  blocked = signal(false);

  data: IAnonGradeLine[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private anonymityService: AnonymityService,
    private messageService: MessageService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('examid');
      if (!id) return;

      this.examId = +id;
      this.refresh();
    });
  }

  gotoExam(): void {
    this.router.navigateByUrl('/exam/' + this.examId);
  }

  refresh(): void {
    this.blocked.set(true);
    this.anonymityService.exportGradesAnonJson(this.examId).subscribe({
      next: res => (this.data = res ?? []),
      error: err =>
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.title ?? err?.message ?? 'Export impossible',
        }),
      complete: () => this.blocked.set(false),
    });
  }

  downloadJson(): void {
    const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json;charset=utf-8' });
    FileSaver.saveAs(blob, `grades_anon_exam_${this.examId}.json`);
  }

  downloadCsv(): void {
    const header = 'anonymousNumber;note\n';
    const body = this.data.map(l => `${l.anonymousNumber};${String(l.note).replace('.', ',')}`).join('\n');
    const blob = new Blob([header + body + '\n'], { type: 'text/csv;charset=utf-8' });
    FileSaver.saveAs(blob, `grades_anon_exam_${this.examId}.csv`);
  }
}
