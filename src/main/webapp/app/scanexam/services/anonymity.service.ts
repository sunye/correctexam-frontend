import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { Observable } from 'rxjs';
import { IAnonGradeLine, IAnonymityExamDTO, IJuryMappingDTO } from '../anonymity/anonymity.model';

@Injectable({
  providedIn: 'root',
})
export class AnonymityService {
  constructor(
    private http: HttpClient,
    private applicationConfigService: ApplicationConfigService,
  ) {}

  importAnonNumbers(examId: number, numbers: string[]): Observable<unknown> {
    return this.http.post(this.applicationConfigService.getEndpointFor(`api/importAnonNumbers/${examId}`), numbers);
  }

  associateAnon(examId: number, data: IAnonymityExamDTO[]): Observable<unknown> {
    return this.http.post(this.applicationConfigService.getEndpointFor(`api/associateAnon/${examId}`), data);
  }

  importJuryMapping(examId: number, mappings: IJuryMappingDTO[]): Observable<unknown> {
    return this.http.post(this.applicationConfigService.getEndpointFor(`api/importJuryMapping/${examId}`), mappings);
  }

  exportGradesAnonJson(examId: number): Observable<IAnonGradeLine[]> {
    return this.http.get<IAnonGradeLine[]>(this.applicationConfigService.getEndpointFor(`api/exportGradesAnonJson/${examId}`));
  }

  getAnonNumbers(examId: number): Observable<IAnonymityExamDTO[]> {
    return this.http.get<IAnonymityExamDTO[]>(this.applicationConfigService.getEndpointFor(`api/anonNumbers/${examId}`));
  }
}
