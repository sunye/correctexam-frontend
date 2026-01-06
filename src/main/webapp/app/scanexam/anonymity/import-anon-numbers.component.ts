/* eslint-disable @typescript-eslint/member-ordering */
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { DataUtils } from 'app/core/util/data-util.service';
import { AnonymityService } from '../services/anonymity.service';

import { MessageService } from 'primeng/api';
import { FileUploadModule, FileUpload, FileUploadHandlerEvent } from 'primeng/fileupload';
import { Button } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { BlockUIModule } from 'primeng/blockui';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'jhi-import-anon-numbers',
  standalone: true,
  templateUrl: './import-anon-numbers.component.html',
  providers: [MessageService],
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    ToastModule,
    BlockUIModule,
    ProgressSpinnerModule,
    MessageModule,
    FileUploadModule,
    Button,
  ],
})
export class ImportAnonNumbersComponent implements OnInit {
  examId!: number;

  protected blocked = false;
  protected rawText = '';

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
      if (id) this.examId = +id;
    });
  }

  gotoExam(): void {
    this.router.navigateByUrl('/exam/' + this.examId);
  }

  private parseNumbersFromText(text: string): string[] {
    return text
      .split(/[\r\n,;\t ]+/g)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  protected importFromTextarea(): void {
    const numbers = this.parseNumbersFromText(this.rawText);
    this.send(numbers);
  }

  protected importFromFile(_event: unknown, _form: unknown): void {
    const event = _event as FileUploadHandlerEvent;
    const form = _form as FileUpload;

    if (!event.files || event.files.length === 0) return;

    this.dataUtils.loadFile(event.files[0], result => {
      const text =
        typeof result === 'string' ? result : result instanceof ArrayBuffer ? new TextDecoder('utf-8').decode(result) : String(result);

      const numbers = this.parseNumbersFromText(text);
      this.send(numbers);
      form?.clear?.();
    });
  }

  private send(numbers: string[]): void {
    if (!this.examId) return;

    const payload = Array.from(new Set(numbers));

    this.blocked = true;
    this.anonymityService.importAnonNumbers(this.examId, payload).subscribe({
      next: () =>
        this.messageService.add({
          severity: 'success',
          summary: 'OK',
          detail: `Import terminé : ${payload.length} numéro(s)`,
        }),
      error: err =>
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: err?.error?.title ?? err?.message ?? 'Import impossible',
        }),
      complete: () => (this.blocked = false),
    });
  }
}
